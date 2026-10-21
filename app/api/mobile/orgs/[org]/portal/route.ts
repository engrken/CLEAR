// Live, read-only tenant management status for administrators of this tenant.
// Global Superadmin uses the separate /api/mobile/global/* session and routes.
// The caller cannot choose a different organization by ID in the query/body.

import { ApiFailure, handler, preflight } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { isAdminRole } from '@/lib/roles';
import { prisma } from '@/lib/prisma';

type Ctx = { params: Promise<{ org: string }> };

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const { officer, org } = await requireMobileOfficer(req, slug, null);
  if (!isAdminRole(officer.role)) {
    throw new ApiFailure(403, 'forbidden', 'Only an active tenant administrator can view this portal.');
  }

  const where = { organizationId: org.id };
  const [studentsCount, officersCount, currentTermCollectionsCount] = await Promise.all([
    prisma.student.count({ where }),
    prisma.tenantUser.count({ where: { ...where, status: 'Active' } }),
    prisma.collection.count({ where: { ...where, academicYear: org.activeAy, term: org.activeTerm } }),
  ]);

  return {
    organization: {
      subdomain: org.subdomain,
      name: org.name,
      type: org.type,
      status: org.status,
      tier: org.tier,
      schoolGroup: org.schoolGroup,
      activeAy: org.activeAy,
      activeTerm: org.activeTerm,
    },
    studentsCount,
    officersCount,
    currentTermCollectionsCount,
    mode: 'read_only' as const,
    asOf: new Date().toISOString(),
  };
});

export const OPTIONS = preflight;
