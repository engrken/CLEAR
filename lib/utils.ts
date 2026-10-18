/** Display-friendly rounding; invalid/empty input displays as zero. NOT for server-action validation. */
export function money(val: number | string | null | undefined): number {
  if (val === null || val === undefined || String(val).trim() === '') return 0;
  const n = Number(val);
  return Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
}

/** Strict money parsing for financial writes; rejects NaN, infinity, malformed and negative values. */
export function requireMoney(val: unknown, label = 'Amount'): number {
  if (val === null || val === undefined || String(val).trim() === '') {
    throw new Error(`${label} is required.`);
  }
  const n = Number(val);
  if (!Number.isFinite(n) || n < 0 || !Number.isSafeInteger(Math.round(n * 100))) {
    throw new Error(`${label} must be a non-negative finite monetary value.`);
  }
  if (Math.abs(n * 100 - Math.round(n * 100)) > 0.000001) {
    throw new Error(`${label} must not have more than two decimal places.`);
  }
  return Math.round(n * 100) / 100;
}

export function fmt(val: number | string | null | undefined): string {
  return '₱' + money(val).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Escapes text when building raw HTML/email; JSX already escapes content. */
export function sanitizeHTML(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function formatHoursAndMinutes(decimalHours: number | string): string {
  const n = Number(decimalHours);
  if (!Number.isFinite(n) || n <= 0) return '0 hrs';
  const total = Math.round(n * 60);
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  if (hrs && mins) return `${hrs} hr${hrs > 1 ? 's' : ''} ${mins} min${mins > 1 ? 's' : ''}`;
  if (hrs) return `${hrs} hr${hrs > 1 ? 's' : ''}`;
  return `${mins} min${mins > 1 ? 's' : ''}`;
}
