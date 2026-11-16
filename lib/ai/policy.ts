/** Small pure policy helpers shared by the server gate and CI unit tests. */
export function isAiPaidTier(tier: string | null | undefined): boolean {
  return tier === 'Pro' || tier === 'Corporate';
}

export function aiDailyQuota(tier: string): number {
  if (tier === 'Corporate') return 100;
  if (tier === 'Pro') return 30;
  return 0;
}

/** Rolling 24h tenant budgets cap total external requests across officer accounts. */
export function aiTenantDailyQuota(tier: string): number {
  if (tier === 'Corporate') return 500;
  if (tier === 'Pro') return 120;
  return 0;
}

/** Global administrators are not tenant officers for AI access purposes. */
export function canUseAiAsTenantOfficer(isSuper: boolean): boolean {
  return !isSuper;
}

/**
 * Production-only controlled rollout.
 * Permitted entries must be scoped to a department AND an officer account:
 * "department-slug:officer@example.edu,other-slug:auditor@example.edu".
 * No wildcard support; absent/empty configuration fails closed.
 * Full rollout requires a second explicit mode setting.
 */
export function canUseAiRollout(
  department: string,
  email: string,
  allowlist: string | undefined,
  mode: string | undefined,
): boolean {
  if (mode === 'all-paid') return true;
  if (mode !== 'officers') return false;
  const normalized = `${department.trim().toLowerCase()}:${email.trim().toLowerCase()}`;
  return (allowlist || '').split(',').some(entry => entry.trim().toLowerCase() === normalized);
}
