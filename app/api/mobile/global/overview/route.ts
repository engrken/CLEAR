// Read-only global overview. No user provisioning, impersonation or financial writes.
import { handler, preflight } from '@/lib/mobile/http';
import { requireGlobalMobileAdmin } from '@/lib/mobile/global-session';
import { prisma } from '@/lib/prisma';

export const GET = handler(async (req: Request) => {
  await requireGlobalMobileAdmin(req);
  const [orgs, adminCounts, officerRoles] = await Promise.all([
    prisma.organization.findMany({
      select: {
        id: true, subdomain: true, name: true, type: true, status: true, activeAy: true, activeTerm: true,
        _count: { select: { students: true, tenantUsers: true } },
      },
      orderBy: [{ name: 'asc' }],
    }),
    prisma.globalSuperAdmin.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.tenantUser.groupBy({
      by: ['organizationId', 'role'],
      where: { status: 'Active' },
      _count: { _all: true },
    }),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    organizations: orgs.map(({ _count, id, ...org }) => ({
      ...org,
      studentsCount: _count.students,
      officersCount: _count.tenantUsers,
      // Role names are labels from TenantUser, not system-wide privileges.
      activeRoles: officerRoles
        .filter((r) => r.organizationId === id)
        .map((r) => ({ role: r.role, count: r._count._all }))
        .sort((a, b) => a.role.localeCompare(b.role)),
    })),
    globalAdmins: {
      active: adminCounts.find((g) => g.status === 'Active')?._count._all ?? 0,
      pending: adminCounts.find((g) => g.status === 'Pending')?._count._all ?? 0,
    },
  };
});
export const OPTIONS = preflight;
