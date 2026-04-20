export function normalizeColumnName(header: string): string {
  const compact = header.trim().toLowerCase().replace(/\s+/g, " ");
  const cleaned = compact.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  return cleaned;
}

export function sanitizeCellValue(value: unknown): string {
  const asString = String(value ?? "")
    .replace(/\r?\n/g, " ")
    .trim();

  if (asString.startsWith("=")) {
    return asString.slice(1).trim();
  }

  return asString;
}

export function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
