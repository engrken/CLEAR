/**
 * Dates and times as the CLEAR web app shows them: Philippine time
 * (Asia/Manila, UTC+08:00, no daylight saving), whatever zone the phone is in.
 *
 * Date-only fields (payment dates) arrive as `YYYY-MM-DDT12:00:00Z` or a bare
 * `YYYY-MM-DD`; both land on the same Manila calendar day.
 *
 * Intl with `timeZone` works on Hermes in recent React Native, but if the
 * engine throws or ignores the zone we format by hand from a +08:00 offset.
 */

const ZONE = 'Asia/Manila';
const OFFSET_MS = 8 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Style = 'date' | 'shortDate' | 'time' | 'dateTime';

const OPTIONS: Record<Style, Intl.DateTimeFormatOptions> = {
  date: { year: 'numeric', month: 'short', day: 'numeric' }, // Oct 18, 2026
  shortDate: { month: 'short', day: 'numeric' }, // Oct 18
  time: { hour: 'numeric', minute: '2-digit' }, // 9:42 AM
  dateTime: { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }, // Oct 18, 2026, 9:42 AM
};

/** True when Intl formats in Asia/Manila: 2020-01-01T16:30Z is 2 Jan, 00:30 there. */
const intlHonoursZone = (() => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: ZONE, day: 'numeric', hour: 'numeric', hourCycle: 'h23' })
      .formatToParts(new Date(Date.UTC(2020, 0, 1, 16, 30)));
    const day = parts.find((p) => p.type === 'day')?.value;
    const hour = parts.find((p) => p.type === 'hour')?.value;
    return day === '2' && Number(hour) === 0;
  } catch {
    return false;
  }
})();

const formatters: Partial<Record<Style, Intl.DateTimeFormat | null>> = {};

function intlFormatter(style: Style): Intl.DateTimeFormat | null {
  if (!intlHonoursZone) return null;
  if (formatters[style] === undefined) {
    try {
      formatters[style] = new Intl.DateTimeFormat('en-PH', { ...OPTIONS[style], timeZone: ZONE });
    } catch {
      formatters[style] = null;
    }
  }
  return formatters[style] ?? null;
}

/** The instant shifted to Manila wall-clock time, read back with getUTC*. */
const manilaWall = (ms: number) => new Date(ms + OFFSET_MS);

function manual(ms: number, style: Style): string {
  const d = manilaWall(ms);
  const h = d.getUTCHours();
  const time = `${h % 12 || 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  const shortDate = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  const date = `${shortDate}, ${d.getUTCFullYear()}`;
  return { date, shortDate, time, dateTime: `${date}, ${time}` }[style];
}

/** Milliseconds for an ISO string, a bare `YYYY-MM-DD`, a Date or epoch ms; NaN when unreadable. */
function toMs(value: string | number | Date): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  // A bare date is a Manila calendar day; anchor it at noon so no zone can move it.
  const bare = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (bare) return Date.UTC(+bare[1], +bare[2] - 1, +bare[3], 12) - OFFSET_MS;
  return Date.parse(value);
}

function format(value: string | number | Date | null | undefined, style: Style): string {
  if (value === null || value === undefined || value === '') return '';
  const ms = toMs(value);
  if (!Number.isFinite(ms)) return typeof value === 'string' ? value : '';
  const f = intlFormatter(style);
  if (f) {
    try {
      return f.format(ms);
    } catch {
      // fall through to the manual format
    }
  }
  return manual(ms, style);
}

type DateInput = string | number | Date | null | undefined;

/** `Oct 18, 2026` in Manila. Use for date-only fields such as payment dates. */
export const formatDate = (v: DateInput) => format(v, 'date');
/** `Oct 18` in Manila. */
export const formatShortDate = (v: DateInput) => format(v, 'shortDate');
/** `9:42 AM` in Manila. */
export const formatTime = (v: DateInput) => format(v, 'time');
/** `Oct 18, 2026, 9:42 AM` in Manila. */
export const formatDateTime = (v: DateInput) => format(v, 'dateTime');

/** The Manila calendar day of an instant as `YYYY-MM-DD` (exact: the Philippines has no DST). */
export function manilaDay(v: string | number | Date): string {
  const ms = toMs(v);
  if (!Number.isFinite(ms)) return '';
  return manilaWall(ms).toISOString().slice(0, 10);
}

/** `9:42 AM` for today (Manila), otherwise `Oct 17, 9:42 AM`. For activity lists. */
export function formatWhen(v: DateInput, now: number = Date.now()): string {
  if (v === null || v === undefined || v === '') return '';
  if (manilaDay(v) === manilaDay(now)) return formatTime(v);
  const short = formatShortDate(v);
  const time = formatTime(v);
  return short && time ? `${short}, ${time}` : short || time;
}
