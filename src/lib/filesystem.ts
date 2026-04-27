import { mkdirSync } from "node:fs";
import { DATA_DIR, EXPORT_DIR, QR_DIR } from "./constants";

/**
 * Ensures all required runtime directories exist.
 * Called on server startup to prepare the filesystem.
 * Uses recursive: true to create parent directories automatically.
 */
export function ensureRuntimeDirectories(): void {
  // Synchronously creates a directory. Returns undefined, or if recursive is true, the first directory path created. This is the synchronous version of mkdir.
  // recursive: true means "create parent directories if they don't exist"
  // Like: mkdir -p data/
  mkdirSync(DATA_DIR, { recursive: true }); // Create data directory (stores database file)
  // Once created, they persist on disk between server restarts.
  // The database and QR files remain until explicitly deleted. This is intentional for local-first operation.
  mkdirSync(QR_DIR, { recursive: true }); // Create QR directory (stores generated QR codes)
  mkdirSync(EXPORT_DIR, { recursive: true }); // Create export directory (stores downloadable ZIP batches)
}

/**
 * Converts a user input string into a safe filesystem identifier.
 * Lowercases, trims, removes special characters, and converts to kebab-case.
 * Example: "John Doe!" → "john-doe"
 * Used for safe filenames and identifiers.
 */
export function toSafeIdentifier(value: string): string {
  // Trim whitespace, lowercase, and replace all non-alphanumeric characters with hyphens
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-");

  // Remove multiple consecutive hyphens and clean up leading/trailing hyphens
  const squashed = normalized.replace(/-+/g, "-").replace(/^[-_]+|[-_]+$/g, "");

  // Return fallback if string becomes empty after sanitization
  if (squashed.length === 0) {
    return "unknown-id";
  }

  return squashed;
}

/**
 * Generates a deterministic ZIP filename with timestamp.
 * Format: kichi_qr_batch_YYYYMMDD_HHMMSS.zip
 * Ensures unique exports and sorts chronologically by filename.
 */
export function makeZipFileName(now = new Date()): string {
  // Extract date components from the provided Date (or current time if not provided)
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0"); // padStart ensures "01" not "1"
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  // Return filename in YYYYMMDD_HHMMSS format for sorting and uniqueness
  return `kichi_qr_batch_${year}${month}${day}_${hours}${minutes}${seconds}.zip`;
}

/**
 * Validates that a filename is safe for download.
 * Prevents directory traversal and special character injection.
 * Only allows alphanumeric, dots, hyphens, and underscores.
 */

// Directory traversal means an attacker tries to access files outside the intended directory by using patterns like "../" in the filename. This function ensures that the filename does not contain any characters that could be used for such attacks, allowing only safe characters.
export function isSafeDownloadName(fileName: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(fileName);
}
