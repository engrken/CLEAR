// Pure, deterministic policy model for the future CENTRAL server-enforced
// maintenance controller. This module alone does not activate maintenance:
// proxy/server-action enforcement and audited admin controls are separate
// release gates. Current Production still uses CLEAR_MAINTENANCE_MODE=locked.
export type MaintenanceMode = 'normal' | 'read_only' | 'full';
export type MaintenanceScope = 'global' | 'tenant';

export type MaintenanceRule = {
  id: string;
  enabled: boolean;
  scope: MaintenanceScope;
  tenantId: string | null;
  mode: Exclude<MaintenanceMode, 'normal'>;
  startsAt: Date;
  endsAt: Date;
  reason: string;
};

export type EffectiveMaintenance = {
  mode: MaintenanceMode;
  reason: string;
  effectiveUntil: string | null;
  sourceRuleId: string | null;
};

const order: Record<MaintenanceMode, number> = { normal: 0, read_only: 1, full: 2 };

function active(rule: MaintenanceRule, at: Date): boolean {
  return rule.enabled && ['full','read_only'].includes(rule.mode) &&
    Number.isFinite(rule.startsAt.getTime()) && Number.isFinite(rule.endsAt.getTime()) &&
    rule.endsAt.getTime() > rule.startsAt.getTime() &&
    rule.startsAt.getTime() <= at.getTime() && at.getTime() < rule.endsAt.getTime();
}
function safeReason(reason: string): string {
  return String(reason ?? '').replace(/[<>\x00-\x1F]/g, ' ').trim().slice(0, 240) ||
    'Scheduled CLEAR maintenance';
}
/** Global scope takes precedence over tenant scope, then most restrictive
 * mode, then latest expiry and stable id for deterministic results.
 * Caller must authenticate a tenant before using tenant-scoped results.
 */
export function resolveMaintenance(
  rules: readonly MaintenanceRule[], now: Date, tenantId: string | null,
): EffectiveMaintenance {
  if (!Number.isFinite(now.getTime())) throw new Error('Invalid maintenance clock');
  const global = rules.filter(r => r.scope === 'global' && r.tenantId === null && active(r, now));
  const local = rules.filter(r => r.scope === 'tenant' && tenantId !== null &&
    r.tenantId === tenantId && active(r, now));
  const relevant = global.length ? global : local;
  const winner = [...relevant].sort((a,b) =>
    order[b.mode] - order[a.mode] ||
    b.endsAt.getTime() - a.endsAt.getTime() ||
    a.id.localeCompare(b.id)
  )[0];
  return winner
    ? { mode: winner.mode, reason: safeReason(winner.reason),
        effectiveUntil: winner.endsAt.toISOString(), sourceRuleId: winner.id }
    : { mode: 'normal', reason: '', effectiveUntil: null, sourceRuleId: null };
}

/** These are only policy decisions for tests and future server enforcement.
 * The current proxy remains the separate global emergency lock.
 */
export function maintenanceRequestAllowed(
  mode: MaintenanceMode, method: string, path: string,
): boolean {
  if (mode === 'normal') return true;
  const verb = method.toUpperCase();
  const read = verb === 'GET' || verb === 'HEAD';
  if (mode === 'read_only') return read;
  // Full shutdown must not expose financial/student API GETs or permit OTP POST.
  return verb === 'GET' &&
    (path === '/maintenance' || path === '/api/maintenance/status');
}

export function emergencyEnvironmentMode(value: string | undefined): MaintenanceMode {
  return value === 'locked' ? 'full' : 'normal';
}
