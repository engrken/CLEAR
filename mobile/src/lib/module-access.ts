/**
 * Labels and availability of the web system's tab grants in the Android preview.
 *
 * This is NOT an authority list. Grant decisions must be read from the signed-in
 * officer's server-supplied allowedTabs and rechecked by requireMobileOfficer
 * on each protected API request.
 */
export type MobileAvailability = 'available' | 'review-only' | 'paused' | 'web-only';

export const MODULE_CATALOG: ReadonlyArray<{
  tab: string;
  name: string;
  availability: MobileAvailability;
  detail: string;
}> = [
  { tab: 'tab-overview', name: 'Financial overview', availability: 'available', detail: 'Read-only financial dashboard and recent activity' },
  { tab: 'tab-students', name: 'Student roster', availability: 'available', detail: 'View your department roster' },
  { tab: 'tab-clearance', name: 'Clearance', availability: 'available', detail: 'Public student clearance inquiry; officer details require server authorization' },
  { tab: 'tab-payment', name: 'Payment collection', availability: 'paused', detail: 'Official receipt issuance and posting disabled until accounting parity passes' },
  { tab: 'tab-remittances', name: 'Online remittances', availability: 'review-only', detail: 'Review proofs; verification and invalidation currently disabled' },
  { tab: 'tab-penalties', name: 'Penalties', availability: 'web-only', detail: 'Use the web system for penalty management' },
  { tab: 'tab-advances', name: 'Cash advances', availability: 'web-only', detail: 'Use the web system for advances and liquidation' },
  { tab: 'tab-audit', name: 'Liquidations and audit', availability: 'web-only', detail: 'Use the web system for auditing' },
  { tab: 'tab-collectibles', name: 'Collectibles', availability: 'web-only', detail: 'Use the web system for collectibles' },
  { tab: 'tab-reports', name: 'Financial reports', availability: 'web-only', detail: 'Use the web system for official financial reports' },
  { tab: 'tab-void', name: 'Void center', availability: 'web-only', detail: 'Use the web system for financial reversals' },
  { tab: 'tab-report', name: 'Report submission', availability: 'web-only', detail: 'Use the web system for report submission' },
  { tab: 'tab-transfer', name: 'Fund realignment', availability: 'web-only', detail: 'Use the web system for transfers' },
  { tab: 'tab-users', name: 'Officer management', availability: 'web-only', detail: 'Use the web system to manage roles and permissions' },
  { tab: 'tab-setup', name: 'Department setup', availability: 'web-only', detail: 'Use the web system for configuration' },
];

export function grantedModules(allowedTabs: readonly string[]) {
  const granted = new Set(allowedTabs);
  return MODULE_CATALOG.filter((module) => granted.has(module.tab));
}
