/** Pure presentation helpers only. Authorization and enforcement stay server-side. */
export type PublicMaintenanceNotice = {
  id: string;
  title: string;
  message: string;
  startsAt: string;
  endsAt: string;
  revision: number;
  state: string;
};

export type PublicMaintenanceStatus = {
  mode: string;
  reason: string;
  scope: string;
  effectiveUntil: string | null;
  lastChangedAt?: string | null;
  notices: PublicMaintenanceNotice[];
};

/** Open an advisory before login, not during normal authenticated navigation. */
export function isMaintenanceEntryPath(pathname: string): boolean {
  return pathname === '/' || pathname === '/dashboard' ||
    pathname === '/dashboard/entity/login' ||
    /^\/department\/[a-z0-9-]+\/?$/.test(pathname) ||
    /^\/department\/[a-z0-9-]+\/clearance\/?$/.test(pathname);
}

/** Each audience, policy change, notice revision and activation has its own acknowledgement. */
export function maintenanceAdvisoryKey(status: PublicMaintenanceStatus, tenant: string | null): string {
  if (status.mode === 'NORMAL' && status.notices.length === 0) return '';
  const noticeVersions = status.notices.map(n =>
    [n.id, n.revision, n.state].join(':')).sort().join('|');
  return ['clear-maintenance-advisory-v1', tenant || 'global',
    status.mode, status.lastChangedAt || '', noticeVersions].join('::');
}

export function maintenanceSummary(status: PublicMaintenanceStatus): string {
  const active = status.notices.find(n => n.state === 'ACTIVE');
  const upcoming = status.notices.find(n => n.state === 'UPCOMING');
  if (status.mode === 'FULL') return 'Service temporarily unavailable';
  if (status.mode === 'READ_ONLY') return 'Read-only maintenance active';
  if (active) return active.title;
  if (upcoming) return 'Scheduled: ' + upcoming.title;
  return 'Service operating normally';
}
