/**
 * Labels and availability of assigned web and native modules in CLEAR v1.5.0.
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
  { tab: 'tab-students', name: 'Student roster', availability: 'available', detail: 'Review students; audited add and edit controls available after separate authorization', webPath: '/students' },
  { tab: 'tab-clearance', name: 'Clearance', availability: 'available', detail: 'Public student clearance inquiry; officer details require server authorization', webPath: '/clearance' },
  { tab: 'tab-payment', name: 'Collections', availability: 'review-only', detail: 'Review receipt allocation lines in Android; official receipts and payment posting remain on secure web', webPath: '/collections' },
  { tab: 'tab-remittances', name: 'Online remittances', availability: 'review-only', detail: 'Review proofs in app; verify or invalidate in the audited web workflow', webPath: '/remittances' },
  { tab: 'tab-penalties', name: 'Penalties', availability: 'review-only', detail: 'View recent assessments and remaining balances; settlements require secure web access', webPath: '/penalties' },
  { tab: 'tab-advances', name: 'Cash advances', availability: 'review-only', detail: 'Review approved advances; issuing or changing them remains on the audited web app', webPath: '/advances' },
  { tab: 'tab-audit', name: 'Liquidations and audit', availability: 'review-only', detail: 'Review recorded liquidation expenses and audit status; web remains authoritative', webPath: '/liquidations' },
  { tab: 'tab-collectibles', name: 'Collectibles', availability: 'web-only', detail: 'Use the web system for collectibles', webPath: '/collectibles' },
  { tab: 'tab-reports', name: 'Financial reports', availability: 'web-only', detail: 'Use the web system for official financial reports', webPath: '/reports' },
  { tab: 'tab-void', name: 'Void center', availability: 'review-only', detail: 'Browse read-only tenant Void history in Android; all reversals are handled on secure web', webPath: '/void' },
  { tab: 'tab-report', name: 'Report submission', availability: 'web-only', detail: 'Use the web system for report submission', webPath: '/reports' },
  { tab: 'tab-transfer', name: 'Fund realignment', availability: 'web-only', detail: 'Use the web system for transfers', webPath: '/realign' },
  { tab: 'tab-users', name: 'Officer management', availability: 'available', detail: 'Review accounts and manage authorized status changes in Android; creating officers and editing roles remain on web', webPath: '/users' },
  { tab: 'tab-setup', name: 'Department setup', availability: 'web-only', detail: 'Use the web system for configuration', webPath: '/setup' },
];

export function grantedModules(allowedTabs: readonly string[]) {
  const granted = new Set(allowedTabs);
  return MODULE_CATALOG.filter((module) => granted.has(module.tab));
}
