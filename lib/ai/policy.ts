/** Small pure policy helpers shared by the server gate and CI unit tests. */
export function isAiPaidTier(tier: string | null | undefined): boolean {
  return tier === 'Pro' || tier === 'Corporate';
}

export function aiDailyQuota(tier: string): number {
  if (tier === 'Corporate') return 100;
  if (tier === 'Pro') return 30;
  return 0;
}

/** Global administrators are not tenant officers for AI access purposes. */
export function canUseAiAsTenantOfficer(isSuper: boolean): boolean {
  return !isSuper;
}
