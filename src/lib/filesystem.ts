import { mkdirSync } from "node:fs";
import { DATA_DIR, EXPORT_DIR, QR_DIR } from "./constants";

export function ensureRuntimeDirectories(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(QR_DIR, { recursive: true });
  mkdirSync(EXPORT_DIR, { recursive: true });
}

export function toSafeIdentifier(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-");
  const squashed = normalized.replace(/-+/g, "-").replace(/^[-_]+|[-_]+$/g, "");

  if (squashed.length === 0) {
    return "unknown-id";
  }

  return squashed;
}

export function makeZipFileName(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `kichi_qr_batch_${year}${month}${day}_${hours}${minutes}${seconds}.zip`;
}

export function isSafeDownloadName(fileName: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(fileName);
}
