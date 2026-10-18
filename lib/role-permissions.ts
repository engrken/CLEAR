/** Browser-safe tab permission presets. Never import database or auth code here. */
export const PRESET_ROLE_TABS: Record<string, string[]> = {
  admin: [
    'tab-overview', 'tab-students', 'tab-clearance', 'tab-payment', 'tab-remittances',
    'tab-penalties', 'tab-advances', 'tab-audit', 'tab-collectibles', 'tab-reports',
    'tab-void', 'tab-report', 'tab-transfer', 'tab-users', 'tab-setup',
  ],
  treasurer: [
    'tab-overview', 'tab-clearance', 'tab-reports', 'tab-payment',
    'tab-remittances', 'tab-penalties', 'tab-advances', 'tab-collectibles',
    'tab-report', 'tab-transfer',
  ],
  auditor: ['tab-overview', 'tab-clearance', 'tab-reports', 'tab-audit', 'tab-report'],
  viewer: ['tab-overview', 'tab-clearance', 'tab-reports', 'tab-report'],
};

const KNOWN_TABS = new Set(Object.values(PRESET_ROLE_TABS).flat());

export function parseAllowedTabs(value: unknown): string[] {
  let source: unknown = value;
  if (typeof source === 'string') {
    try { source = JSON.parse(source); } catch { return []; }
  }
  if (!Array.isArray(source)) return [];
  return Array.from(new Set(source.filter(
    (tab): tab is string => typeof tab === 'string' && KNOWN_TABS.has(tab),
  )));
}
