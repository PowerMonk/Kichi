export function logEvent(
  eventName: string,
  details?: Record<string, unknown>,
): void {
  const timestamp = new Date().toISOString();

  if (!details || Object.keys(details).length === 0) {
    console.log(`[${timestamp}] ${eventName}`);
    return;
  }

  console.log(`[${timestamp}] ${eventName}`, details);
}
