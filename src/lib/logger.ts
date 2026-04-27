/**
 * Logs an event with timestamp and optional details.
 * Used throughout the application to track important operations.
 * Output format: [ISO_TIMESTAMP] eventName { details }
 * Logs are printed to console.log for debugging and audit trail.
 */
export function logEvent(
  eventName: string,
  details?: Record<string, unknown>,
): void {
  // Get current timestamp in ISO format (e.g., "2026-04-26T10:30:45.123Z")
  const timestamp = new Date().toISOString();

  // If no details provided, log just the event name and timestamp
  if (!details || Object.keys(details).length === 0) {
    console.log(`[${timestamp}] ${eventName}`);
    return;
  }

  // Log event name, timestamp, and details object
  console.log(`[${timestamp}] ${eventName}`, details);
}
