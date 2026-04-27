/**
 * Normalizes column headers from spreadsheets.
 * Converts to lowercase, replaces spaces with underscores, removes special characters.
 * Example: "First Name" → "first_name", "Email Address!" → "email_address"
 * Used to standardize column names for mapping.
 */
export function normalizeColumnName(header: string): string {
  // Trim and lowercase the header, collapse multiple spaces into one
  const compact = header.trim().toLowerCase().replace(/\s+/g, " ");

  // Replace non-alphanumeric characters with underscores, remove leading/trailing underscores
  const cleaned = compact.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  return cleaned;
}

/**
 * Sanitizes cell values from spreadsheet files.
 * Removes formula prefixes (cells starting with "="), trims whitespace, handles line breaks.
 * Prevents formula injection attacks by stripping leading "=".
 * Example: "=CONCAT(A1,B1)" → "CONCAT(A1,B1)"
 */
export function sanitizeCellValue(value: unknown): string {
  // Convert to string, remove line breaks (\r\n or \n), trim whitespace
  const asString = String(value ?? "")
    .replace(/\r?\n/g, " ")
    .trim();

  // If the value starts with "=", it's a spreadsheet formula
  // Remove the "=" prefix to prevent formula execution
  if (asString.startsWith("=")) {
    return asString.slice(1).trim();
  }

  return asString;
}

/**
 * Validates an email address format.
 * Uses basic regex pattern: something@something.something
 * Does not perform DNS validation, just format checking.
 * Accepts: user@domain.com, test@co.uk, etc.
 * Rejects: plaintext, @domain.com, user@domain, user @domain.com
 */
export function isValidEmailAddress(email: string): boolean {
  // Regex breakdown:
  // [^\s@]+ : one or more non-whitespace, non-@ characters
  // @ : literal @ symbol
  // [^\s@]+ : one or more non-whitespace, non-@ characters
  // \. : literal dot
  // [^\s@]+ : one or more non-whitespace, non-@ characters
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
