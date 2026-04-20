import { join } from "node:path";
import { unlink } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { controlNumberExists, persistRecord } from "../lib/database";
import { EXPORT_DIR, QR_DIR } from "../lib/constants";
import { makeZipFileName, toSafeIdentifier } from "../lib/filesystem";
import { logEvent } from "../lib/logger";
import { isValidEmailAddress } from "../lib/validators";
import { sendSequentialEmails } from "./email-service";
import { generateQrBuffer } from "./qr-service";
import { parseSpreadsheetFile } from "./spreadsheet-service";
import { createZipArchive } from "./zip-service";

export interface ColumnMap {
  name: string;
  email: string;
  role: string;
  controlNumber: string;
}

export interface PipelineInput {
  file: File;
  map: ColumnMap;
  sendEmails: boolean;
}

export interface PipelineFailure {
  rowNumber: number;
  reason: string;
}

interface GeneratedRecord {
  uuid: string;
  name: string;
  email: string;
  role: string;
  controlNumber: string;
  qrFileName: string;
  qrFilePath: string;
}

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
    qrUrl: string;
  }>;
  failures: PipelineFailure[];
}

function assertColumnMap(columns: string[], map: ColumnMap): void {
  const requiredMappings = [
    ["name", map.name],
    ["email", map.email],
    ["role", map.role],
    ["controlNumber", map.controlNumber],
  ] as const;

  for (const [field, columnName] of requiredMappings) {
    if (!columnName || columnName.trim().length === 0) {
      throw new Error(`Column mapping is missing for ${field}.`);
    }

    if (!columns.includes(columnName)) {
      throw new Error(
        `Mapped column '${columnName}' for ${field} was not found in the file.`,
      );
    }
  }
}

export async function runPipeline(
  input: PipelineInput,
): Promise<PipelineResult> {
  const parsed = await parseSpreadsheetFile(input.file);
  assertColumnMap(parsed.columns, input.map);

  logEvent("File imported", {
    fileName: parsed.fileName,
    rows: parsed.rows.length,
  });

  const generated: GeneratedRecord[] = [];
  const failures: PipelineFailure[] = [];
  const seenControlNumbers = new Set<string>();

  for (let index = 0; index < parsed.rows.length; index += 1) {
    const row = parsed.rows[index] ?? {};
    const rowNumber = index + 2;

    logEvent("Row parsed", { rowNumber });

    const name = (row[input.map.name] ?? "").trim();
    const email = (row[input.map.email] ?? "").trim().toLowerCase();
    const role = (row[input.map.role] ?? "").trim();
    const controlNumber = (row[input.map.controlNumber] ?? "").trim();

    if (!name || !email || !role || !controlNumber) {
      failures.push({
        rowNumber,
        reason:
          "Missing required field (name, email, role, or control number).",
      });
      continue;
    }

    if (!isValidEmailAddress(email)) {
      failures.push({
        rowNumber,
        reason: `Invalid email format: ${email}`,
      });
      continue;
    }

    if (seenControlNumbers.has(controlNumber)) {
      failures.push({
        rowNumber,
        reason: `Duplicate control number in file: ${controlNumber}`,
      });
      continue;
    }

    if (controlNumberExists(controlNumber)) {
      failures.push({
        rowNumber,
        reason: `Control number already exists in database: ${controlNumber}`,
      });
      continue;
    }

    seenControlNumbers.add(controlNumber);

    const safeIdentifier = toSafeIdentifier(controlNumber);
    const qrFileName = `${safeIdentifier}.png`;
    const qrFilePath = join(QR_DIR, qrFileName);
    const uuid = crypto.randomUUID();

    logEvent("UUID generated", {
      rowNumber,
      uuid,
      controlNumber,
    });

    try {
      const qrBuffer = await generateQrBuffer(uuid);
      await writeFile(qrFilePath, qrBuffer);

      logEvent("QR generated", {
        rowNumber,
        uuid,
        filePath: qrFilePath,
      });

      persistRecord({
        uuid,
        name,
        email,
        role,
        controlNumber,
        qrFilePath,
      });

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
      await unlink(qrFilePath).catch(() => undefined);
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

  let zipUrl: string | null = null;

  if (generated.length > 0) {
    const zipName = makeZipFileName();
    const zipPath = join(EXPORT_DIR, zipName);

    await createZipArchive(
      zipPath,
      generated.map((item) => ({
        sourcePath: item.qrFilePath,
        archiveName: item.qrFileName,
      })),
    );

    zipUrl = `/api/download/zip/${encodeURIComponent(zipName)}`;
    logEvent("ZIP exported", {
      filePath: zipPath,
      fileCount: generated.length,
    });
  }

  let emailSentCount = 0;
  let emailFailedCount = 0;

  if (input.sendEmails && generated.length > 0) {
    const emailResult = await sendSequentialEmails(
      generated.map((item) => ({
        name: item.name,
        email: item.email,
        controlNumber: item.controlNumber,
        qrFilePath: item.qrFilePath,
      })),
      logEvent,
    );

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
      qrUrl: `/api/download/qr/${encodeURIComponent(item.qrFileName)}`,
    })),
    failures,
  };
}
