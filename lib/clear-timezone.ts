/**
 * CLEAR's canonical business time zone.
 *
 * The real instant is stored in UTC/timestamptz; never add eight hours to a
 * Date or serialize a "Manila-shifted" Date back to PostgreSQL.
 * These formatters use Asia/Manila regardless of browser or Vercel timezone.
 */
export const CLEAR_TIME_ZONE = 'Asia/Manila' as const;

type DateValue = Date | string | number;

/** Returns yyyy-MM-dd for the Philippine calendar day of an instant. */
export function manilaDateInput(value: DateValue = new Date()): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid date');
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: CLEAR_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Date-only display for transactions, notices and tables (10/18/2026). */
export function formatManilaDate(value: DateValue): string {
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: CLEAR_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(value));
}

/** Printed date in long form (October 18, 2026). */
export function formatManilaLongDate(value: DateValue): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CLEAR_TIME_ZONE,
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(value));
}

/** Printed date in short form (Oct 18, 2026). */
export function formatManilaShortDate(value: DateValue): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CLEAR_TIME_ZONE,
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(value));
}

/** Audit/export display, always includes the zone designation. */
export function formatManilaDateTime(value: DateValue): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CLEAR_TIME_ZONE, dateStyle: 'medium',
    timeStyle: 'medium', hour12: true,
  }).format(new Date(value)) + ' PHT';
}

/** Stable 24-hour PHT timestamp for history tables and CSV records. */
export function formatManilaDateTime24(value: DateValue): string {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: CLEAR_TIME_ZONE,
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${manilaDateInput(date)} ${get('hour')}:${get('minute')}:${get('second')} PHT`;
}

/** Manila calendar year, not the server's calendar year. */
export function manilaYear(value: DateValue = new Date()): number {
  return Number(manilaDateInput(value).slice(0, 4));
}

/** Manila calendar month, numbered 1 through 12. */
export function manilaMonth(value: DateValue = new Date()): number {
  return Number(manilaDateInput(value).slice(5, 7));
}

/**
 * True Manila-local day window in UTC instants.
 * Use { gte: start, lt: end } for event-timestamp queries.
 * Do not use this for historical "date-only at 12:00Z" accounting data
 * unless its semantics and conversion policy have been reviewed.
 */
export function manilaDayWindow(ymd: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error('Expected yyyy-MM-dd');
  const start = new Date(`${ymd}T00:00:00+08:00`);
  if (!Number.isFinite(start.getTime()) || manilaDateInput(start) !== ymd) {
    throw new Error('Invalid Manila calendar date');
  }
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
