// lib/utils.ts

/**
 * Formats a numeric value into Philippine Peso (₱) currency string.
 * Migrated from the legacy fmt() function in app.js.
 */
export function fmt(val: number | string | null | undefined): string {
  const num = parseFloat(String(val)) || 0;
  return "₱" + num.toLocaleString("en-US", { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}

/**
 * Sanitizes HTML strings.
 * Migrated from the legacy sanitizeHTML() function in app.js.
 * Note: React automatically escapes variables in JSX, so you will rarely 
 * need this unless you are explicitly using dangerouslySetInnerHTML.
 */
export function sanitizeHTML(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formats decimal hours into a readable 'X hrs Y mins' string.
 * Migrated from penalties.js for global use.
 */
export function formatHoursAndMinutes(decimalHours: number | string): string {
  const dec = parseFloat(String(decimalHours)) || 0;
  if (dec <= 0) return "0 hrs";
  
  const totalMins = Math.round(dec * 60);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  if (hrs > 0 && mins > 0) {
    return `${hrs} hr${hrs > 1 ? 's' : ''} ${mins} min${mins > 1 ? 's' : ''}`;
  } else if (hrs > 0) {
    return `${hrs} hr${hrs > 1 ? 's' : ''}`;
  } else {
    return `${mins} min${mins > 1 ? 's' : ''}`;
  }
}