/** Shared pure rules for all CLEAR maintenance request gates.
 * No authentication decision is made by these helpers.
 */
export type MaintenanceMode = 'NORMAL' | 'READ_ONLY' | 'FULL';
export type MaintenanceSnapshot = {
  mode: MaintenanceMode; reason: string; expiresAt: Date | null;
  updatedAt: Date | null; scope: string;
};
export const NORMAL: MaintenanceSnapshot = {
  mode: 'NORMAL', reason: '', expiresAt: null, updatedAt: null, scope: 'GLOBAL',
};
export function validMode(mode: string): mode is MaintenanceMode {
  return mode === 'NORMAL' || mode === 'READ_ONLY' || mode === 'FULL';
}
export function activeMode(row: MaintenanceSnapshot | null, now = new Date()): MaintenanceSnapshot {
  if (!row || (row.expiresAt && row.expiresAt.getTime() <= now.getTime())) return NORMAL;
  return validMode(row.mode) ? row : NORMAL;
}
export function effectivePolicy(
  global: MaintenanceSnapshot | null, tenant: MaintenanceSnapshot | null, now = new Date(),
): MaintenanceSnapshot {
  const g = activeMode(global, now);
  if (g.mode !== 'NORMAL') return g;
  const t = activeMode(tenant, now);
  return t.mode !== 'NORMAL' ? t : g;
}
export function tenantSlugFromPath(pathname: string): string | null {
  const m = /^\/(?:department|api\/department|api\/mobile\/orgs|api\/mobile\/global\/orgs)\/([^/]+)/.exec(pathname);
  if (!m) return null;
  try {
    const slug = decodeURIComponent(m[1]).trim().toLowerCase();
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug) ? slug : null;
  } catch { return null; }
}
/** Admin console mutations are checked in requireSuperAdmin before any DB write.
 * Auth callbacks are permitted solely for operator recovery, not for finance.
 */

/** Tenant routing is shared by the server proxy and the web notice banner.
 * A localhost tenant hostname is used only in the established local workflow;
 * ordinary public domains must derive tenancy from the URL path.
 */
export function tenantFromLocation(pathname: string, hostname: string): string | null {
  const routeTenant = tenantSlugFromPath(pathname);
  if (routeTenant) return routeTenant;
  const tenant = /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.localhost$/.exec(hostname.toLowerCase())?.[1];
  return tenant && tenant !== 'www' ? tenant : null;
}

export function isRecoveryPath(path: string): boolean {
  return path === '/maintenance' ||
    path === '/api/maintenance/status' ||
    path === '/api/maintenance/notices' ||
    path === '/dashboard/provisions/maintenance' ||
    path.startsWith('/api/auth/') ||
    path.startsWith('/api/mobile/global/auth/');
}
export function isReadOnlyAuthenticationPath(pathname: string): boolean {
  // This endpoint issues only an OTP, with existing per-email cooldown and
  // guessing limits. Never exempt whole tenant POST pages or Server Actions.
  if (/^\/api\/department\/[a-z0-9-]+\/auth\/request-code$/.test(pathname)) return true;
  // Mobile challenge/login/session lifecycle, not profile or finance writes.
  return /^\/api\/mobile\/orgs\/[a-z0-9-]+\/(?:auth|clearance\/auth)\/(?:request-code|verify-code|session)$/.test(pathname);
}
export function requestDecision(mode: MaintenanceMode, method: string, pathname: string):
  'ALLOW' | 'READ_ONLY_BLOCK' | 'FULL_BLOCK' {
  if (isRecoveryPath(pathname)) return 'ALLOW';
  if (mode === 'FULL') return 'FULL_BLOCK';
  // HEAD, GET and OPTIONS are read-only; prohibit all other methods including
  // RSC Server Action POSTs and direct API writes. Authorization still applies.
  if (mode === 'READ_ONLY' && !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) &&
      !(method.toUpperCase() === 'POST' && isReadOnlyAuthenticationPath(pathname))) {
    return 'READ_ONLY_BLOCK';
  }
  return 'ALLOW';
}

/** Scheduled notices are evaluated against the server clock on every guarded request.
 * No cron, browser timer, or mutable activation flag is needed for enforcement.
 * A published NORMAL notice is an announcement only. FULL dominates READ_ONLY
 * when windows overlap within the same scope. The existing global-over-tenant
 * precedence remains unchanged.
 */
export type ScheduledMaintenanceWindow = {
  scopeKey: string; mode: string; title: string;
  startsAt: Date; endsAt: Date; updatedAt: Date;
};
const severity = (mode: MaintenanceMode): number =>
  mode === 'FULL' ? 2 : mode === 'READ_ONLY' ? 1 : 0;

export function strongestScheduledWindow(
  windows: readonly ScheduledMaintenanceWindow[], scopeKey: string, now = new Date(),
): MaintenanceSnapshot | null {
  let result: MaintenanceSnapshot | null = null;
  for (const window of windows) {
    if (window.scopeKey !== scopeKey || !validMode(window.mode) || window.mode === 'NORMAL' ||
        window.startsAt.getTime() > now.getTime() || window.endsAt.getTime() <= now.getTime()) continue;
    if (!result || severity(window.mode) > severity(result.mode)) {
      result = { mode: window.mode, reason: window.title, scope: scopeKey,
        expiresAt: window.endsAt, updatedAt: window.updatedAt };
    }
  }
  return result;
}
export function combinePolicyWithScheduled(
  policy: MaintenanceSnapshot | null, scheduled: MaintenanceSnapshot | null, now = new Date(),
): MaintenanceSnapshot | null {
  const manual = activeMode(policy, now);
  const timed = activeMode(scheduled, now);
  const chosen = severity(timed.mode) > severity(manual.mode) ? timed : manual;
  return chosen.mode === 'NORMAL' ? null : chosen;
}
