import 'server-only';
import { prisma } from '@/lib/prisma';
import { effectivePolicy, type MaintenanceMode, type MaintenanceSnapshot } from './rules';

/** This module requires committed migration before deploying the proxy.
 * DB errors propagate and are treated as 503 (fail-closed), never NORMAL.
 */
export async function maintenanceForTenant(slug?: string | null): Promise<MaintenanceSnapshot> {
  const keys = ['GLOBAL', ...(slug ? ['tenant:' + slug] : [])];
  const rows = await prisma.maintenancePolicy.findMany({ where: { scopeKey: { in: keys } } });
  const convert = (key: string): MaintenanceSnapshot | null => {
    const row = rows.find(v => v.scopeKey === key);
    return row ? { mode: row.mode as MaintenanceMode, reason: row.reason,
      expiresAt: row.expiresAt, updatedAt: row.updatedAt, scope: row.scopeKey } : null;
  };
  return effectivePolicy(convert('GLOBAL'), slug ? convert('tenant:' + slug) : null);
}

export async function maintenancePublicState(tenant?: string | null) {
  const status = await maintenanceForTenant(tenant);
  const now = new Date();
  const notices = await prisma.maintenanceNotice.findMany({
    where: { scopeKey: { in: ['GLOBAL', ...(tenant ? ['tenant:' + tenant] : [])] },
      state: 'SCHEDULED', endsAt: { gt: now },
      startsAt: { lt: new Date(now.getTime() + 30 * 86400000) } },
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    take: 12,
    select: { id: true, title: true, message: true, startsAt: true, endsAt: true,
      updatedAt: true, version: true, scopeKey: true },
  });
  return {
    mode: status.mode,
    reason: status.reason.slice(0, 240),
    scope: status.scope === 'GLOBAL' ? 'GLOBAL' : 'TENANT',
    effectiveUntil: status.expiresAt?.toISOString() ?? null,
    lastChangedAt: status.updatedAt?.toISOString() ?? null,
    serverTime: now.toISOString(),
    notices: notices.map(n => ({
      id: n.id, title: n.title, message: n.message,
      startsAt: n.startsAt.toISOString(), endsAt: n.endsAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(), revision: n.version,
      scope: n.scopeKey === 'GLOBAL' ? 'GLOBAL' : 'TENANT',
      state: n.startsAt <= now ? 'ACTIVE' : 'UPCOMING',
    })),
  };
}
