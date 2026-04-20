import * as XLSX from "xlsx";
import { MAX_UPLOAD_SIZE_BYTES, SUPPORTED_EXTENSIONS } from "../lib/constants";
import { normalizeColumnName, sanitizeCellValue } from "../lib/validators";

export type SpreadsheetRow = Record<string, string>;

export interface ParsedSpreadsheet {
  fileName: string;
  columns: string[];
  rows: SpreadsheetRow[];
}

function getFileExtension(fileName: string): string {
  const segments = fileName.toLowerCase().split(".");

  if (segments.length < 2) {
    return "";
  }

  return segments[segments.length - 1] ?? "";
}

function buildUniqueHeaders(rawHeaders: unknown[]): string[] {
  const counters = new Map<string, number>();

  return rawHeaders.map((cell, index) => {
    const source = sanitizeCellValue(cell);
    const base = normalizeColumnName(source) || `column_${index + 1}`;
    const seen = counters.get(base) ?? 0;
    counters.set(base, seen + 1);

    if (seen === 0) {
      return base;
    }

    return `${base}_${seen + 1}`;
  });
}

export async function parseSpreadsheetFile(
  file: File,
): Promise<ParsedSpreadsheet> {
  const extension = getFileExtension(file.name);

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error("Unsupported file type. Please upload CSV or XLSX.");
  }

  if (file.size === 0) {
    throw new Error("The uploaded file is empty.");
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error("The uploaded file is too large.");
  }

  const rawContent = await file.arrayBuffer();
  const workbook = XLSX.read(rawContent, {
    type: "array",
    cellFormula: false,
    dense: false,
    raw: false,
  });

  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("No worksheets found in the file.");
  }

  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error("Unable to read worksheet data.");
  }

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });

  if (matrix.length === 0) {
    throw new Error("The worksheet does not contain data.");
  }

  const headerRow = matrix[0] ?? [];
  const columns = buildUniqueHeaders(headerRow);
  const rows: SpreadsheetRow[] = [];

  for (const rowValues of matrix.slice(1)) {
    const row: SpreadsheetRow = {};
    let hasData = false;

    columns.forEach((column, index) => {
      const cell = rowValues[index];
      const value = sanitizeCellValue(cell);

      if (value.length > 0) {
        hasData = true;
      }

      row[column] = value;
    });

    if (hasData) {
      rows.push(row);
    }
  }

  return {
    fileName: file.name,
    columns,
    rows,
  };
}
