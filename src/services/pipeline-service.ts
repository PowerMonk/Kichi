import { join } from "node:path";
import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises"; // unlink is used to delete files, in this case to clean up QR code files if something goes wrong during generation or persistence.
import { writeFile } from "node:fs/promises";
import { persistRecord } from "../lib/database";
import { EXPORT_DIR, QR_DIR } from "../lib/constants";
import { makeZipFileName, toSafeIdentifier } from "../lib/filesystem";
import { logEvent } from "../lib/logger";
import { isValidEmailAddress } from "../lib/validators";
import { sendSequentialEmails } from "./email-service";
import { generateQrBuffer } from "./qr-service";
import { parseSpreadsheetFile } from "./spreadsheet-service";
import { createZipArchive } from "./zip-service";

/**
 * Maps spreadsheet columns to attendee fields.
 * Name and email are required; other fields are optional.
 */
export interface ColumnMap {
  name: string;
  email: string;
  role?: string;
  controlNumber?: string;
}

/**
 * Input parameters for the full QR generation pipeline.
 * Includes file, column mapping, and email preference.
 */
export interface PipelineInput {
  file: File;
  map: ColumnMap;
  sendEmails: boolean;
}

/**
 * Records a failure during pipeline processing.
 * Includes row number and reason for failure.
 */
export interface PipelineFailure {
  rowNumber: number;
  reason: string;
}

/**
 * Internal representation of a successfully generated record.
 * Contains all attendee data and paths to generated QR files.
 */
interface GeneratedRecord {
  uuid: string;
  name: string;
  email: string;
  role: string;
  controlNumber: string;
  qrFileName: string;
  qrFilePath: string;
}

/**
 * Final result of the entire QR generation pipeline.
 * Includes summary counts, file URLs, generated records, and failures.
 * Sent back to the frontend as JSON response.
 */
export interface PipelineResult {
  columns: string[];
  totalRows: number;
  createdCount: number;
  failedCount: number;
  emailSentCount: number;
  emailFailedCount: number;
  zipUrl: string | null;
  records: Array<{
    uuid: string;
    name: string;
    role: string;
    email: string;
    controlNumber: string;
    qrFileName: string;
    qrUrl: string;
  }>;
  failures: PipelineFailure[];
}

/**
 * Validates that all required column mappings exist in the parsed spreadsheet.
 * Throws an error if a mapped column is missing or invalid.
 */
function assertColumnMap(columns: string[], map: ColumnMap): void {
  // Define required field-to-column mappings
  const requiredMappings = [
    ["name", map.name],
    ["email", map.email],
  ] as const;

  const optionalMappings = [
    ["role", map.role],
    ["controlNumber", map.controlNumber],
  ] as const;

  // Check each required mapping
  for (const [field, columnName] of requiredMappings) {
    // Ensure the mapped column name is not empty
    if (!columnName || columnName.trim().length === 0) {
      throw new Error(`Column mapping is missing for ${field}.`);
    }

    // Ensure the mapped column actually exists in the spreadsheet
    if (!columns.includes(columnName)) {
      throw new Error(
        `Mapped column '${columnName}' for ${field} was not found in the file.`,
      );
    }
  }

  // Optional mappings only need to exist if provided
  for (const [field, columnName] of optionalMappings) {
    if (!columnName || columnName.trim().length === 0) continue;

    if (!columns.includes(columnName)) {
      throw new Error(
        `Mapped column '${columnName}' for ${field} was not found in the file.`,
      );
    }
  }
}

/**
 * Main QR generation pipeline orchestrator.
 * Coordinates the entire workflow:
 * 1. Parses uploaded spreadsheet
 * 2. Validates column mappings
 * 3. Processes each row: validate, generate UUID, create QR, save to DB
 * 4. Generates ZIP archive of all QRs
 * 5. Optionally sends emails with QR attachments
 * 6. Returns comprehensive result with records and failures
 */
export async function runPipeline(
  input: PipelineInput,
): Promise<PipelineResult> {
  // Parse the uploaded spreadsheet file
  const parsed = await parseSpreadsheetFile(input.file);

  // Validate that all user-mapped columns exist in the spreadsheet
  assertColumnMap(parsed.columns, input.map);

  // Log the import event
  logEvent("File imported", {
    fileName: parsed.fileName,
    rows: parsed.rows.length,
  });

  // Initialize arrays to track results
  const generated: GeneratedRecord[] = []; // Successfully generated records
  const failures: PipelineFailure[] = []; // Failed rows with reasons
  const seenFileNames = new Set<string>(); // Track file names to prevent collisions within this batch

  // Process each row from the spreadsheet
  for (let index = 0; index < parsed.rows.length; index += 1) {
    const row = parsed.rows[index] ?? {};
    const rowNumber = index + 2; // Row numbers start at 2 (row 1 is header)

    logEvent("Row parsed", { rowNumber });

    // Extract and normalize field values from the row
    const name = (row[input.map.name] ?? "").trim();
    const email = (row[input.map.email] ?? "").trim().toLowerCase();
    const roleRaw = input.map.role ? (row[input.map.role] ?? "").trim() : "";
    const controlRaw = input.map.controlNumber
      ? (row[input.map.controlNumber] ?? "").trim()
      : "";
    const role = roleRaw || "N/A";
    const controlNumber = controlRaw || "N/A";

    // Validate that all required fields have values
    if (!name || !email) {
      failures.push({
        rowNumber,
        reason: "Missing required field (name or email).",
      });
      continue;
    }

    // Validate email format
    if (!isValidEmailAddress(email)) {
      failures.push({
        rowNumber,
        reason: `Invalid email format: ${email}`,
      });
      continue;
    }

    // Generate safe filename from first name + email prefix
    const firstName = name.split(/\s+/)[0] ?? "";
    const emailPrefix = email.split("@")[0] ?? "";
    const safeIdentifier = toSafeIdentifier(`${firstName}-${emailPrefix}`);
    let qrFileName = `${safeIdentifier}.png`;
    let duplicateIndex = 1;

    // Ensure the file name is unique to avoid overwriting existing QR files
    while (
      seenFileNames.has(qrFileName) ||
      existsSync(join(QR_DIR, qrFileName))
    ) {
      duplicateIndex += 1;
      qrFileName = `${safeIdentifier}-${duplicateIndex}.png`;
    }

    seenFileNames.add(qrFileName);
    const qrFilePath = join(QR_DIR, qrFileName);
    const uuid = crypto.randomUUID(); // Generate unique identifier for this attendee

    logEvent("UUID generated", {
      rowNumber,
      uuid,
      controlNumber,
    });

    try {
      // Generate QR code PNG image
      const qrBuffer = await generateQrBuffer(uuid);

      // Save QR image to disk
      await writeFile(qrFilePath, qrBuffer);

      logEvent("QR generated", {
        rowNumber,
        uuid,
        filePath: qrFilePath,
      });

      // Persist attendee record and QR reference to database
      persistRecord({
        uuid,
        name,
        email,
        role,
        controlNumber,
        qrFilePath,
      });

      // Add to generated records list
      generated.push({
        uuid,
        name,
        email,
        role,
        controlNumber,
        qrFileName,
        qrFilePath,
      });
    } catch (error) {
      // If anything fails, clean up the generated QR file
      await unlink(qrFilePath).catch(() => undefined);

      // Record the failure
      const reason =
        error instanceof Error
          ? error.message
          : "Failed to generate QR record.";

      failures.push({
        rowNumber,
        reason,
      });
    }
  }

  // Generate ZIP archive of all successfully generated QRs
  let zipUrl: string | null = null;

  if (generated.length > 0) {
    const zipName = makeZipFileName();
    const zipPath = join(EXPORT_DIR, zipName);

    // Create ZIP with all QR files
    await createZipArchive(
      zipPath,
      generated.map((item) => ({
        sourcePath: item.qrFilePath,
        archiveName: item.qrFileName,
      })),
    );

    // Generate download URL for the ZIP
    zipUrl = `/api/download/zip/${encodeURIComponent(zipName)}`;
    logEvent("ZIP exported", {
      filePath: zipPath,
      fileCount: generated.length,
    });
  }

  // Send emails if requested
  let emailSentCount = 0;
  let emailFailedCount = 0;

  if (input.sendEmails && generated.length > 0) {
    // Send emails sequentially to avoid SMTP rate limiting
    const emailResult = await sendSequentialEmails(
      generated.map((item) => ({
        name: item.name,
        email: item.email,
        controlNumber: item.controlNumber,
        qrFileName: item.qrFileName,
        qrFilePath: item.qrFilePath,
      })),
      logEvent,
    );

    // If SMTP is not configured, add a failure note
    if (!emailResult.enabled) {
      failures.push({
        rowNumber: 0,
        reason:
          "Email requested but SMTP environment variables are not configured.",
      });
    }

    emailSentCount = emailResult.sentCount;
    emailFailedCount = emailResult.failed.length;
  }

  // Return comprehensive result
  return {
    columns: parsed.columns,
    totalRows: parsed.rows.length,
    createdCount: generated.length,
    failedCount: failures.length,
    emailSentCount,
    emailFailedCount,
    zipUrl,
    records: generated.map((item) => ({
      uuid: item.uuid,
      name: item.name,
      role: item.role,
      email: item.email,
      controlNumber: item.controlNumber,
      qrFileName: item.qrFileName,
      qrUrl: `/api/download/qr/${encodeURIComponent(item.qrFileName)}`,
    })),
    failures,
  };
}
