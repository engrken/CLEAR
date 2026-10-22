/** Exact module mappings for same-page presence; never trust a client-provided permission. */
export const PRESENCE_TABS = {
  overview: 'tab-overview',
  students: 'tab-students',
  clearance: 'tab-clearance',
  collections: 'tab-payment',
  'cashier-remittance': 'tab-payment',
  remittances: 'tab-remittances',
  advances: 'tab-advances',
  liquidations: 'tab-audit',
  penalties: 'tab-penalties',
  collectibles: 'tab-collectibles',
  reports: 'tab-reports',
  summary: 'tab-report',
  realign: 'tab-transfer',
  void: 'tab-void',
  users: 'tab-users',
  setup: 'tab-setup',
  logs: 'tab-users',
} as const;

export type PresencePage = keyof typeof PRESENCE_TABS;

export function normalizePresencePage(value: unknown): PresencePage | null {
  return typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(PRESENCE_TABS, value)
    ? value as PresencePage : null;
}
export function presencePageKey(page: PresencePage, ay: unknown, term: unknown) {
  const year = typeof ay === 'string' ? ay.trim() : '';
  const period = typeof term === 'string' ? term.trim() : '';
  if (!year || year.length > 90 || !period || period.length > 70) return null;
  // No delimiters can confuse distinct module/year/term combinations.
  return JSON.stringify([page, year, period]);
}
