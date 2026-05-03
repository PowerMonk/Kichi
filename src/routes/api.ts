import { EXPORT_DIR, QR_DIR } from "../lib/constants";
import { getAttendeeByUuid } from "../lib/database";
import { isSafeDownloadName } from "../lib/filesystem";
import { logEvent } from "../lib/logger";
import { ColumnMap, runPipeline } from "../services/pipeline-service";
import { parseSpreadsheetFile } from "../services/spreadsheet-service";

// cors == cross origin resource sharing, a security feature implemented by browsers to restrict web pages from making requests to a different domain than the one that served the web page. The corsHeaders function generates the necessary HTTP headers to allow cross-origin requests from any domain, enabling the frontend (which may be served from a different origin) to communicate with this API without being blocked by the browser's same-origin policy.

/**
 * CORS (Cross-Origin Resource Sharing) headers.
 * Allows the frontend to make requests to this API from any origin.
 * Browser security policy blocks cross-origin requests by default;
 * these headers explicitly allow them.
 */
function corsHeaders(): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
}

/**
 * Wraps a JSON payload in a Response with correct headers and status code.
 * All API responses use this to ensure consistent formatting and CORS headers.
 */
function jsonResponse(payload: unknown, status = 200): Response {
  const headers = corsHeaders();
  headers.set("Content-Type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(payload), {
    status,
    headers,
  });
}

/**
 * Shorthand for returning a JSON error response.
 * Wraps the error message in { error: "message" } format.
 */
function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

function normalizeUuid(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  const directMatch = trimmed.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
  );
  if (directMatch) return directMatch[0];

  const stripped = trimmed.replace(/[^0-9a-f]/g, "");
  if (stripped.length !== 32) return null;

  return `${stripped.slice(0, 8)}-${stripped.slice(8, 12)}-${stripped.slice(
    12,
    16,
  )}-${stripped.slice(16, 20)}-${stripped.slice(20)}`;
}

/**
 * Parses and validates the column mapping from the frontend.
 * Ensures all required fields (name, email, role, controlNumber) are strings.
 * Throws if the mapping is invalid or missing required fields.
 */
function parseColumnMap(input: string): ColumnMap {
  // Parse JSON string from frontend
  const parsed = JSON.parse(input) as Partial<ColumnMap>;

  // Validate that all required fields exist and are strings
  if (
    typeof parsed.name !== "string" ||
    typeof parsed.email !== "string" ||
    typeof parsed.role !== "string" ||
    typeof parsed.controlNumber !== "string"
  ) {
    throw new Error("Invalid column mapping payload.");
  }

  // Return validated, typed mapping object
  return {
    name: parsed.name,
    email: parsed.email,
    role: parsed.role,
    controlNumber: parsed.controlNumber,
  };
}

/**
 * Handles POST /api/parse requests.
 * Accepts a spreadsheet file upload and extracts:
 * - Column names
 * - Row count
 * - Preview of first 6 rows
 * Returns this data to the frontend for column mapping.
 */
async function handleParseRequest(request: Request): Promise<Response> {
  // Extract file from multipart form data
  const form = await request.formData();
  const file = form.get("file");

  // Validate that a file was actually uploaded
  if (!(file instanceof File)) {
    return errorResponse("Missing uploaded file.", 400);
  }

  // Parse CSV/XLSX file and extract rows and column names
  const parsed = await parseSpreadsheetFile(file);

  // Log the import event for debugging/audit trail
  logEvent("File imported", {
    fileName: parsed.fileName,
    rows: parsed.rows.length,
  });

  // Return column names, row count, and preview to frontend
  return jsonResponse({
    fileName: parsed.fileName,
    columns: parsed.columns,
    rowCount: parsed.rows.length,
    preview: parsed.rows.slice(0, 6), // First 6 rows for user preview
  });
}

/**
 * Handles POST /api/generate requests.
 * Accepts a spreadsheet file + column mapping.
 * Runs the full QR generation pipeline:
 * - Generates UUIDs per row
 * - Creates QR images
 * - Saves to database
 * - Optionally sends emails
 * Returns summary of what was generated.
 */
async function handleGenerateRequest(request: Request): Promise<Response> {
  // Extract file and mapping from multipart form data
  const form = await request.formData();
  const file = form.get("file");

  // Validate that a file was uploaded
  if (!(file instanceof File)) {
    return errorResponse("Missing uploaded file.", 400);
  }

  // Get column mapping as JSON string
  const mapRaw = form.get("map");

  // Validate that mapping was provided
  if (typeof mapRaw !== "string") {
    return errorResponse("Missing map payload.", 400);
  }

  // Parse checkbox: should we send emails? Defaults to false if not provided.
  const sendEmails =
    String(form.get("sendEmails") ?? "false").toLowerCase() === "true";

  // Validate and parse the column mapping
  const map = parseColumnMap(mapRaw);

  // Run the full QR generation pipeline
  // This creates UUIDs, generates QR images, saves to DB, optionally emails
  const result = await runPipeline({
    file,
    map,
    sendEmails,
  });

  // Return results to frontend (e.g., generated count, file paths, email status)
  return jsonResponse(result);
}

/**
 * Handles POST /api/scan requests.
 * Accepts a UUID and returns matching attendee data if found.
 */
async function handleScanRequest(request: Request): Promise<Response> {
  let payload: { uuid?: string };

  try {
    payload = (await request.json()) as { uuid?: string };
  } catch {
    return errorResponse("Invalid JSON payload.", 400);
  }

  const rawUuid = typeof payload.uuid === "string" ? payload.uuid : "";
  const uuid = normalizeUuid(rawUuid) ?? "";

  if (!uuid) {
    return errorResponse("Missing uuid.", 400);
  }

  const attendee = getAttendeeByUuid(uuid);
  const scannedAt = new Date().toISOString();

  logEvent("Scan lookup", {
    uuid,
    rawUuid,
    found: Boolean(attendee),
  });

  return jsonResponse({
    uuid,
    found: Boolean(attendee),
    scannedAt,
    attendee,
  });
}

/**
 * Handles GET requests to download files from the server.
 * Used for both QR images and ZIP archives.
 * baseDir determines which directory to search (EXPORT_DIR or QR_DIR).
 *
 * IMPORTANT: baseDir is the SERVER'S file path where files are stored.
 * When a client downloads, the file goes to their browser's Downloads folder,
 * not influenced by baseDir. baseDir just tells the server where to find the file.
 */
async function handleDownloadRequest(
  baseDir: string, // SERVER'S FILEPATH (e.g., /data/exports/)
  fileName: string, // Name of the file to download
): Promise<Response> {
  // Validate filename format to prevent directory traversal attacks
  // Only allows alphanumeric, dots, hyphens, underscores
  if (!isSafeDownloadName(fileName)) {
    return errorResponse("Invalid file name.", 400);
  }

  // Construct full path on the SERVER's filesystem
  const fullPath = `${baseDir}/${fileName}`;

  // Open the file from the server's disk
  const file = Bun.file(fullPath);

  // Check if the file actually exists on the server
  if (!(await file.exists())) {
    return errorResponse("Requested file was not found.", 404);
  }

  // Set up CORS headers
  const headers = corsHeaders();

  // If it's a ZIP file, add the Content-Disposition header
  // This tells the browser to download (not display) the file
  if (fileName.endsWith(".zip")) {
    headers.set("Content-Disposition", `attachment; filename=\"${fileName}\"`);
  }

  // Return the file bytes to the browser
  // Browser handles saving to the user's Downloads folder
  return new Response(file, {
    status: 200,
    headers,
  });
}

/**
 * Main API request router.
 * Delegates each request to the appropriate handler based on method + pathname.
 * Catches and logs all errors to prevent crashes.
 */
export async function handleApiRequest(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);

  // Handle CORS preflight requests (browser makes these before actual requests)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204, // No Content
      headers: corsHeaders(),
    });
  }

  // the different API routes get called depending on what the user does in the frontend
  try {
    // Health check endpoint. Returns { ok: true } if API is running.
    if (request.method === "GET" && pathname === "/api/health") {
      return jsonResponse({ ok: true, service: "kichi-api" });
    }

    // Parse endpoint: analyzes uploaded spreadsheet, returns columns and preview
    if (request.method === "POST" && pathname === "/api/parse") {
      return await handleParseRequest(request);
    }

    // Generate endpoint: runs full QR pipeline with column mapping
    if (request.method === "POST" && pathname === "/api/generate") {
      return await handleGenerateRequest(request);
    }

    // Scan lookup endpoint: returns attendee data by UUID
    if (request.method === "POST" && pathname === "/api/scan") {
      return await handleScanRequest(request);
    }

    // Download ZIP batch archive by filename
    // URL format: /api/download/zip/{filename}
    if (request.method === "GET" && pathname.startsWith("/api/download/zip/")) {
      const fileName = decodeURIComponent(
        pathname.replace("/api/download/zip/", ""),
      );
      return await handleDownloadRequest(EXPORT_DIR, fileName);
    }

    // Download individual QR image by filename
    // URL format: /api/download/qr/{filename}
    if (request.method === "GET" && pathname.startsWith("/api/download/qr/")) {
      const fileName = decodeURIComponent(
        pathname.replace("/api/download/qr/", ""),
      );
      return await handleDownloadRequest(QR_DIR, fileName);
    }

    // No matching route found
    return errorResponse("Route not found.", 404);
  } catch (error) {
    // Catch any unexpected errors and return 500 response
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    logEvent("API error", { message, path: pathname });
    return errorResponse(message, 500);
  }
}
