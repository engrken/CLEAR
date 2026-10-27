/**
 * Public maintenance policy projection from the SAME canonical Web API.
 * Never accept a device-only maintenance override or cache a NORMAL fallback.
 * All writes/read restrictions remain enforced server-side.
 */
export type ServiceMode = 'NORMAL' | 'READ_ONLY' | 'FULL';
export type ServiceNotice = {
  id: string; title: string; message: string;
  startsAt: string; endsAt: string; revision: number; state: 'UPCOMING' | 'ACTIVE';
};
export type ServiceStatus = {
  mode: ServiceMode; reason: string; effectiveUntil: string | null;
  lastChangedAt: string | null; notices: ServiceNotice[];
};

const obj = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const safeText = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.length <= max &&
    !/[\u0000-\u001f\u007f]/.test(value) ? value : null;
const safeDate = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 40 &&
  Number.isFinite(Date.parse(value));

export function parseServiceStatus(value: unknown): ServiceStatus | null {
  if (!obj(value) || !['NORMAL','READ_ONLY','FULL'].includes(String(value.mode))) return null;
  if (!Array.isArray(value.notices) || value.notices.length > 12) return null;
  const reason = safeText(value.reason, 240);
  if (reason === null) return null;
  if (value.effectiveUntil !== null && !safeDate(value.effectiveUntil)) return null;
  if (value.lastChangedAt !== null && !safeDate(value.lastChangedAt)) return null;
  const notices: ServiceNotice[] = [];
  for (const item of value.notices) {
    if (!obj(item)) return null;
    const title = safeText(item.title, 250), message = safeText(item.message, 2000);
    if (!title || message === null || !safeDate(item.startsAt) || !safeDate(item.endsAt) ||
        typeof item.id !== 'string' || item.id.length > 128 || !item.id ||
        !Number.isSafeInteger(item.revision) || (item.revision as number) < 0 ||
        (item.state !== 'ACTIVE' && item.state !== 'UPCOMING')) return null;
    notices.push({ id: item.id, title, message,
      startsAt: item.startsAt as string, endsAt: item.endsAt as string,
      revision: item.revision as number, state: item.state });
  }
  return { mode: value.mode as ServiceMode, reason,
    effectiveUntil: value.effectiveUntil as string | null,
    lastChangedAt: value.lastChangedAt as string | null, notices };
}

export function serviceAdvisoryKey(status: ServiceStatus, tenant: string | null): string {
  if (status.mode === 'NORMAL' && !status.notices.length) return '';
  return [tenant || 'global',status.mode,status.lastChangedAt || '',
    ...status.notices.map(n => [n.id,n.revision,n.state].join(':')).sort()].join('::');
}

export function serviceStatusUrl(apiUrl: string, tenant: string | null): string {
  const root = apiUrl.replace(/\/api\/mobile\/?$/, '');
  if (!/^https:\/\/[^/?#]+$/i.test(root)) throw new Error('Invalid CLEAR service origin');
  if (tenant && !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(tenant))
    throw new Error('Invalid tenant for maintenance status');
  return root + '/api/maintenance/status' + (tenant ? '?tenant=' + encodeURIComponent(tenant) : '');
}
