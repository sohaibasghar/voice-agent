/**
 * Business-timezone time formatting. Times are stored/transmitted as UTC ISO
 * strings (machine-precise), but callers hear LOCAL time — so every agent-facing
 * time carries a human-readable `label` formatted in the business timezone.
 *
 * The zone comes from BUSINESS_TZ (an IANA name like "Asia/Karachi"); if unset,
 * it falls back to the server's resolved timezone so local dev "just works".
 */

export function resolveBusinessTz(configured?: string): string {
  const tz = configured?.trim();
  if (tz) return tz;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** "Tue, Jun 16, 9:00 AM" rendered in the given IANA timezone. */
export function formatLocal(iso: string | Date, timeZone: string): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}
