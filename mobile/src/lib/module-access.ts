/**
 * Labels and availability of assigned web and native modules in CLEAR v1.2.2.
 *
 * This is NOT an authority list. Grant decisions must be read from the signed-in
 * officer's server-supplied allowedTabs and rechecked by requireMobileOfficer
 * on each protected API request.
 */
export type MobileAvailability = 'available' | 'review-only' | 'paused' | 'web-only';

export const MODULE_CATALOG: readonly {
  tab: string;
  name: string;
  availability: MobileAvailability;
  detail: string;
  /** Existing web route. Web re-authentication and role checks are mandatory. */
  webPath?: string;
}[] = [
  { tab: 'tab-overview', name: 'Financial overview', availability: 'available', detail: 'Financial dashboard and recent activity; web actions require separate sign-in', webPath: '/summary' },
  { tab: 'tab-students', name: 'Student roster', availability: 'available', detail: 'View your department roster', webPath: '/students' },
  { tab: 'tab-clearance', name: 'Clearance', availability: 'available', detail: 'Public student clearance inquiry; officer details require server authorization', webPath: '/clearance' },
  { tab: 'tab-payment', name: 'Payment collection', availability: 'web-only', detail: 'Payment posting remains on the audited web collections page until native accounting parity passes', webPath: '/collections' },
  { tab: 'tab-remittances', name: 'Online remittances', availability: 'review-only', detail: 'Review proofs in app; verify or invalidate in the audited web workflow', webPath: '/remittances' },
  { tab: 'tab-penalties', name: 'Penalties', availability: 'web-only', detail: 'Use the web system for penalty management', webPath: '/penalties' },
  { tab: 'tab-advances', name: 'Cash advances', availability: 'web-only', detail: 'Use the web system for advances and liquidation', webPath: '/advances' },
  { tab: 'tab-audit', name: 'Liquidations and audit', availability: 'web-only', detail: 'Use the web system for auditing', webPath: '/liquidations' },
  { tab: 'tab-collectibles', name: 'Collectibles', availability: 'web-only', detail: 'Use the web system for collectibles', webPath: '/collectibles' },
  { tab: 'tab-reports', name: 'Financial reports', availability: 'web-only', detail: 'Use the web system for official financial reports', webPath: '/reports' },
  { tab: 'tab-void', name: 'Void center', availability: 'web-only', detail: 'Use the web system for financial reversals', webPath: '/void' },
  { tab: 'tab-report', name: 'Report submission', availability: 'web-only', detail: 'Use the web system for report submission', webPath: '/reports' },
  { tab: 'tab-transfer', name: 'Fund realignment', availability: 'web-only', detail: 'Use the web system for transfers', webPath: '/realign' },
  { tab: 'tab-users', name: 'Officer management', availability: 'web-only', detail: 'Use the web system to manage roles and permissions', webPath: '/users' },
  { tab: 'tab-setup', name: 'Department setup', availability: 'web-only', detail: 'Use the web system for configuration', webPath: '/setup' },
];

export function grantedModules(allowedTabs: readonly string[]) {
  const granted = new Set(allowedTabs);
  return MODULE_CATALOG.filter((module) => granted.has(module.tab));
}
