/**
 * Privacy-first web performance events. Keep URL queries, QR tokens,
 * student IDs, tenant identifiers and arbitrary record keys OUT of telemetry.
 * This is used by both Vercel Analytics and Speed Insights.
 */
export type TelemetryEvent = { url: string; route?: string };

function safeRoute(pathname: string): string | null {
  const seg = pathname.split('/').filter(Boolean);
  if (seg[0] === 'clearance' || seg[0] === 'api') return null;
  if (seg.length === 0) return '/';
  if (seg[0] === 'maintenance') return '/maintenance';
  if (seg[0] === 'department') {
    if (seg[2] === 'collections' && seg[3] === 'history') return '/department/[tenant]/collections/history';
    const allowed = ['clearance', 'collections', 'students', 'penalties', 'reports', 'advances', 'audit', 'liquidations', 'settings'];
    return allowed.includes(seg[2]) ? '/department/[tenant]/' + seg[2] : '/department/[tenant]';
  }
  if (seg[0] === 'dashboard') return seg[1] === 'provisions' ? '/dashboard/provisions' : '/dashboard';
  return '/other';
}

export function sanitizeTelemetryEvent<T extends TelemetryEvent>(event: T): T | null {
  try {
    const original = new URL(event.url);
    if (original.protocol !== 'https:' && original.protocol !== 'http:') return null;
    const route = safeRoute(original.pathname);
    if (route === null) return null;
    // Completely replace the URL, not just known secrets in a query string.
    // Avoid personal identifiers in fragment, path, URL credentials or search.
    const scrubbed = new URL(original.origin);
    scrubbed.pathname = route;
    return { ...event, url: scrubbed.toString(), route };
  } catch {
    return null;
  }
}
