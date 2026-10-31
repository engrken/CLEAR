import 'server-only';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { effectivePolicy, strongestScheduledWindow, combinePolicyWithScheduled,
  type MaintenanceMode, type MaintenanceSnapshot } from './rules';

/** This module requires committed migration before deploying the proxy.
 * DB errors propagate and are treated as 503 (fail-closed), never NORMAL.
 */
/** Server-clock driven activation/expiry applies to the proxy and mobile status.
 * Existing manual policies remain as a conservative emergency override.
 */
export async function maintenanceForTenant(slug?: string | null): Promise<MaintenanceSnapshot> {
  const keys = ['GLOBAL', ...(slug ? ['tenant:' + slug] : [])];
  const now = new Date();
  const [rows, windows] = await Promise.all([
    prisma.maintenancePolicy.findMany({ where: { scopeKey: { in: keys } } }),
    prisma.maintenanceNotice.findMany({
      where: { scopeKey: { in: keys }, state: 'SCHEDULED',
        mode: { in: ['READ_ONLY', 'FULL'] },
        startsAt: { lte: now }, endsAt: { gt: now } },
      select: { scopeKey: true, mode: true, title: true, startsAt: true, endsAt: true, updatedAt: true },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    }),
  ]);
  const scoped = (key: string): MaintenanceSnapshot | null => {
    const row = rows.find(v => v.scopeKey === key);
    const manual = row ? { mode: row.mode as MaintenanceMode, reason: row.reason,
      expiresAt: row.expiresAt, updatedAt: row.updatedAt, scope: row.scopeKey } : null;
    return combinePolicyWithScheduled(manual, strongestScheduledWindow(windows, key, now), now);
  };
  return effectivePolicy(scoped('GLOBAL'), slug ? scoped('tenant:' + slug) : null, now);
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

/** Server-side tenant-targeted write gate for provisioning, including Global
 * Administrator requests whose URL cannot reveal the affected organization.
 * A transaction client allows this check to use the same PostgreSQL snapshot
 * as any subsequent group / tenant mutations.
 */
export async function assertMaintenanceWritesAllowed(
  tenantSlugs: string[],
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const slugs = [...new Set(tenantSlugs)];
  const keys = ['GLOBAL', ...slugs.map(slug => 'tenant:' + slug)];
  const now = new Date();
  const client = tx ?? prisma;
  const rows = await client.maintenancePolicy.findMany({
    where: { scopeKey: { in: keys } },
  });
  const windows = await client.maintenanceNotice.findMany({
    where: { scopeKey: { in: keys }, state: 'SCHEDULED',
      mode: { in: ['READ_ONLY', 'FULL'] },
      startsAt: { lte: now }, endsAt: { gt: now } },
    select: { scopeKey: true, mode: true, title: true, startsAt: true, endsAt: true, updatedAt: true },
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
  });
  const scoped = (key: string): MaintenanceSnapshot | null => {
    const row = rows.find(record => record.scopeKey === key);
    const manual = row ? { mode: row.mode as MaintenanceMode, reason: row.reason,
      expiresAt: row.expiresAt, updatedAt: row.updatedAt, scope: row.scopeKey } : null;
    return combinePolicyWithScheduled(manual, strongestScheduledWindow(windows, key, now), now);
  };
  const global = scoped('GLOBAL');
  // Also enforce platform policy when provisioning a completely new tenant.
  if (effectivePolicy(global, null).mode !== 'NORMAL') {
    throw new Error('503 Maintenance: Platform changes are temporarily unavailable.');
  }
  for (const slug of slugs) {
    if (effectivePolicy(global, scoped('tenant:' + slug)).mode !== 'NORMAL') {
      throw new Error('503 Maintenance: Tenant changes are temporarily unavailable.');
    }
  }
}
