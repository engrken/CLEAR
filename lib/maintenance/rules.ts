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
export function isRecoveryPath(path: string): boolean {
  return path === '/maintenance' ||
    path === '/api/maintenance/status' ||
    path === '/api/maintenance/notices' ||
    path === '/dashboard/provisions/maintenance' ||
    path.startsWith('/api/auth/') ||
    path.startsWith('/api/mobile/global/auth/');
}
export function isReadOnlyAuthenticationPath(pathname: string): boolean {
  // Allow ONLY challenge/login/session lifecycle in read-only mode. Payment
  // proofs, profile/email updates and onboarding writes must remain blocked.
  return /^\/api\/mobile\/orgs\/[a-z0-9-]+\/(?:auth|clearance\/auth)\/(?:request-code|verify-code|session)$/.test(pathname);
}
export function requestDecision(mode: MaintenanceMode, method: string, pathname: string):
  'ALLOW' | 'READ_ONLY_BLOCK' | 'FULL_BLOCK' {
  if (isRecoveryPath(pathname)) return 'ALLOW';
  if (mode === 'FULL') return 'FULL_BLOCK';
  // HEAD, GET and OPTIONS are read-only; prohibit all other methods including
  // RSC Server Action POSTs and direct API writes. Authorization still applies.
  if (mode === 'READ_ONLY' && !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) &&
      !isReadOnlyAuthenticationPath(pathname)) {
    return 'READ_ONLY_BLOCK';
  }
  return 'ALLOW';
}
