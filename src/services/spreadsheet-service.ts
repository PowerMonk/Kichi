import * as XLSX from "xlsx";
import { MAX_UPLOAD_SIZE_BYTES, SUPPORTED_EXTENSIONS } from "../lib/constants";
import { normalizeColumnName, sanitizeCellValue } from "../lib/validators";

/**
 * Represents a single row of spreadsheet data.
 * Keys are column names, values are sanitized cell strings.
 */
export type SpreadsheetRow = Record<string, string>;

/**
 * Result of parsing a spreadsheet file.
 * Contains filename, column names, and all parsed rows.
 */
export interface ParsedSpreadsheet {
  fileName: string;
  columns: string[];
  rows: SpreadsheetRow[];
}

/**
 * Extracts file extension from a filename.
 * Used to validate file type (CSV or XLSX).
 * Example: "attendees.xlsx" → "xlsx"
 */
function getFileExtension(fileName: string): string {
  const segments = fileName.toLowerCase().split(".");

  // If no extension found, return empty string
  if (segments.length < 2) {
    return "";
  }

  return segments[segments.length - 1] ?? "";
}

/**
 * Builds a list of unique column headers from raw spreadsheet headers.
 * Normalizes header names and handles duplicates by appending _2, _3, etc.
 * Example: ["Name", "Name", "Email"] → ["name", "name_2", "email"]
 * This ensures all columns have unique identifiers for mapping.
 */
function buildUniqueHeaders(rawHeaders: unknown[]): string[] {
  // Track how many times we've seen each header name
  const counters = new Map<string, number>();

  return rawHeaders.map((cell, index) => {
    // Sanitize and normalize the header text
    const source = sanitizeCellValue(cell);
    const base = normalizeColumnName(source) || `column_${index + 1}`;

    // Get count of how many times we've seen this header
    const seen = counters.get(base) ?? 0;
    counters.set(base, seen + 1);

    // If first occurrence, use the base name. Otherwise, append _N
    if (seen === 0) {
      return base;
    }

    return `${base}_${seen + 1}`;
  });
}

/**
 * Parses a CSV or XLSX spreadsheet file uploaded by the user.
 * Validates file type, size, and content.
 * Extracts column names and row data.
 * Returns parsed data ready for column mapping.
 * Throws descriptive errors for invalid files.
 */
export async function parseSpreadsheetFile(
  file: File,
): Promise<ParsedSpreadsheet> {
  // Extract and validate file extension
  const extension = getFileExtension(file.name);

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error("Unsupported file type. Please upload CSV or XLSX.");
  }

  // Validate that file is not empty
  if (file.size === 0) {
    throw new Error("The uploaded file is empty.");
  }

  // Validate file size doesn't exceed limit (25 MB)
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error("The uploaded file is too large.");
  }

  // Read file into binary buffer
  const rawContent = await file.arrayBuffer();

  // Parse the file using xlsx library
  // cellFormula: false - don't execute formulas, just get values
  // raw: false - format dates and numbers as strings, not raw numbers
  const workbook = XLSX.read(rawContent, {
    type: "array",
    cellFormula: false,
    dense: false,
    raw: false,
  });

  // Get the first sheet name (we only support single-sheet files)
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new Error("No worksheets found in the file.");
  }

  // Get the sheet data
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error("Unable to read worksheet data.");
  }

  // Convert sheet to 2D array format
  // header: 1 - first row is a header, return as array
  // blankrows: false - skip completely empty rows
  // defval: "" - use empty string for missing cells
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    blankrows: false,
    defval: "",
    raw: false,
  });

  // Validate that the file contains data
  if (matrix.length === 0) {
    throw new Error("The worksheet does not contain data.");
  }

  // Extract header row and build unique column names
  const headerRow = matrix[0] ?? [];
  const columns = buildUniqueHeaders(headerRow);
  const rows: SpreadsheetRow[] = [];

  // Process all data rows (skip header row)
  for (const rowValues of matrix.slice(1)) {
    const row: SpreadsheetRow = {};
    let hasData = false;

    // Map each cell value to its corresponding column name
    columns.forEach((column, index) => {
      const cell = rowValues[index];
      // Sanitize cell value (remove formulas, trim whitespace, etc.)
      const value = sanitizeCellValue(cell);

      // Track if this row has any non-empty cells
      if (value.length > 0) {
        hasData = true;
      }

      // Add cell value to row object
      row[column] = value;
    });

    // Only include rows that have at least some data
    // This skips completely empty rows
    if (hasData) {
      rows.push(row);
    }
  }

  // Return the parsed spreadsheet with filename, columns, and data rows
  return {
    fileName: file.name,
    columns,
    rows,
  };
}
