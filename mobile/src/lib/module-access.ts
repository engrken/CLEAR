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
  { tab: 'tab-clearance', name: 'Clearance', availability: 'available', detail: 'Native officer clearance inquiry with outstanding details; enrollment changes via student roster', webPath: '/clearance' },
  { tab: 'tab-payment', name: 'Collections', availability: 'review-only', detail: 'Review receipt allocation lines in Android; official receipts and payment posting remain on secure web', webPath: '/collections' },
  { tab: 'tab-remittances', name: 'Online remittances', availability: 'review-only', detail: 'Review proofs in app; verify or invalidate in the audited web workflow', webPath: '/remittances' },
  { tab: 'tab-penalties', name: 'Penalties', availability: 'review-only', detail: 'View recent assessments and remaining balances; settlements require secure web access', webPath: '/penalties' },
  { tab: 'tab-advances', name: 'Cash advances', availability: 'review-only', detail: 'Review approved advances; issuing or changing them remains on the audited web app', webPath: '/advances' },
  { tab: 'tab-audit', name: 'Liquidations and audit', availability: 'review-only', detail: 'Review recorded liquidation expenses and audit status; web remains authoritative', webPath: '/liquidations' },
  { tab: 'tab-collectibles', name: 'Collectibles', availability: 'review-only', detail: 'Review current-term assessments in app; financial changes require secure web', webPath: '/collectibles' },
  { tab: 'tab-reports', name: 'Financial reports', availability: 'review-only', detail: 'Review unreconciled recorded activity in app; official reports stay on web', webPath: '/reports' },
  { tab: 'tab-void', name: 'Void center', availability: 'review-only', detail: 'Browse read-only tenant Void history in Android; all reversals are handled on secure web', webPath: '/void' },
  { tab: 'tab-report', name: 'Report presentation', availability: 'available', detail: 'Edit report institution heading and signatories with explicit grant; official exports stay on web', webPath: '/reports' },
  { tab: 'tab-transfer', name: 'Fund realignment', availability: 'review-only', detail: 'Review current-term fund transfer history; all movement remains web-only', webPath: '/realign' },
  { tab: 'tab-users', name: 'Officer management', availability: 'available', detail: 'Review accounts and manage authorized status changes in Android; creating officers and editing roles remain on web', webPath: '/users' },
  { tab: 'tab-setup', name: 'Department setup', availability: 'available', detail: 'Review current fee and opening-fund settings; admin calendar editing is separately granted, monetary setup remains web-only', webPath: '/setup' },
];

export function grantedModules(allowedTabs: readonly string[]) {
  const granted = new Set(allowedTabs);
  return MODULE_CATALOG.filter((module) => granted.has(module.tab));
}
