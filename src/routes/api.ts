import { EXPORT_DIR, QR_DIR } from "../lib/constants";
import { isSafeDownloadName } from "../lib/filesystem";
import { logEvent } from "../lib/logger";
import { ColumnMap, runPipeline } from "../services/pipeline-service";
import { parseSpreadsheetFile } from "../services/spreadsheet-service";

function corsHeaders(): Headers {
  return new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
}

function jsonResponse(payload: unknown, status = 200): Response {
  const headers = corsHeaders();
  headers.set("Content-Type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(payload), {
    status,
    headers,
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

function parseColumnMap(input: string): ColumnMap {
  const parsed = JSON.parse(input) as Partial<ColumnMap>;

  if (
    typeof parsed.name !== "string" ||
    typeof parsed.email !== "string" ||
    typeof parsed.role !== "string" ||
    typeof parsed.controlNumber !== "string"
  ) {
    throw new Error("Invalid column mapping payload.");
  }

  return {
    name: parsed.name,
    email: parsed.email,
    role: parsed.role,
    controlNumber: parsed.controlNumber,
  };
}

async function handleParseRequest(request: Request): Promise<Response> {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return errorResponse("Missing uploaded file.", 400);
  }

  const parsed = await parseSpreadsheetFile(file);

  logEvent("File imported", {
    fileName: parsed.fileName,
    rows: parsed.rows.length,
  });

  return jsonResponse({
    fileName: parsed.fileName,
    columns: parsed.columns,
    rowCount: parsed.rows.length,
    preview: parsed.rows.slice(0, 6),
  });
}

async function handleGenerateRequest(request: Request): Promise<Response> {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return errorResponse("Missing uploaded file.", 400);
  }

  const mapRaw = form.get("map");

  if (typeof mapRaw !== "string") {
    return errorResponse("Missing map payload.", 400);
  }

  const sendEmails =
    String(form.get("sendEmails") ?? "false").toLowerCase() === "true";
  const map = parseColumnMap(mapRaw);
  const result = await runPipeline({
    file,
    map,
    sendEmails,
  });

  return jsonResponse(result);
}

async function handleDownloadRequest(
  baseDir: string,
  fileName: string,
): Promise<Response> {
  if (!isSafeDownloadName(fileName)) {
    return errorResponse("Invalid file name.", 400);
  }

  const fullPath = `${baseDir}/${fileName}`;
  const file = Bun.file(fullPath);

  if (!(await file.exists())) {
    return errorResponse("Requested file was not found.", 404);
  }

  const headers = corsHeaders();

  if (fileName.endsWith(".zip")) {
    headers.set("Content-Disposition", `attachment; filename=\"${fileName}\"`);
  }

  return new Response(file, {
    status: 200,
    headers,
  });
}

export async function handleApiRequest(request: Request): Promise<Response> {
  const { pathname } = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(),
    });
  }

  try {
    if (request.method === "GET" && pathname === "/api/health") {
      return jsonResponse({ ok: true, service: "kichi-api" });
    }

    if (request.method === "POST" && pathname === "/api/parse") {
      return await handleParseRequest(request);
    }

    if (request.method === "POST" && pathname === "/api/generate") {
      return await handleGenerateRequest(request);
    }

    if (request.method === "GET" && pathname.startsWith("/api/download/zip/")) {
      const fileName = decodeURIComponent(
        pathname.replace("/api/download/zip/", ""),
      );
      return await handleDownloadRequest(EXPORT_DIR, fileName);
    }

    if (request.method === "GET" && pathname.startsWith("/api/download/qr/")) {
      const fileName = decodeURIComponent(
        pathname.replace("/api/download/qr/", ""),
      );
      return await handleDownloadRequest(QR_DIR, fileName);
    }

    return errorResponse("Route not found.", 404);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    logEvent("API error", { message, path: pathname });
    return errorResponse(message, 500);
  }
}
