import { handler, preflight, readJson, ApiFailure } from '@/lib/mobile/http';
import { requireGlobalMobileAdmin } from '@/lib/mobile/global-session';
import { requireAndroidProvisioningPreview, asProvisioningApiFailure } from '@/lib/mobile/provisioning-policy';
import { provisionEntityWithTierCore } from '@/lib/provisioning/core';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

/** Management directory is available to authenticated global admins only. */
export const GET = handler(async (req: Request) => {
  await requireGlobalMobileAdmin(req);
  const orgs = await prisma.organization.findMany({
    orderBy: [{ schoolGroup: 'asc' }, { name: 'asc' }],
    select: {
      id: true, subdomain: true, name: true, schoolGroup: true,
      tier: true, status: true, type: true, activeAy: true, activeTerm: true,
      createdAt: true,
      _count: { select: { students: true, collections: true, tenantUsers: true } },
    },
  });
  return orgs.map(({ _count, ...org }) => ({
    ...org,
    createdAt: org.createdAt.toISOString(),
    studentsCount: _count.students,
    collectionsCount: _count.collections,
    officersCount: _count.tenantUsers,
  }));
});

/** The same shared, transactional provisioning service used by the web app. */
export const POST = handler(async (req: Request) => {
  const { identity } = await requireGlobalMobileAdmin(req);
  requireAndroidProvisioningPreview();
  const body = await readJson<{
    name: string; subdomain: string; schoolGroup: string;
    tier: string; type: string; initialAcademicYear: string;
    calendarMode: string; includeSummer: boolean;
    adminEmail: string; adminName: string; adminUsername: string;
    confirmation: string;
  }>(req);
  // Require deliberate re-entry of the exact unique tenant slug.
  const slug = typeof body.subdomain === 'string' ? body.subdomain.trim().toLowerCase() : '';
  if (!slug || body.confirmation !== `PROVISION ${slug}`) {
    throw new ApiFailure(400, 'invalid', 'Enter PROVISION followed by the exact tenant subdomain to confirm.');
  }
  try {
    const result = await provisionEntityWithTierCore(identity.email, {
      name: body.name as string,
      subdomain: slug,
      schoolGroup: body.schoolGroup as string,
      tier: body.tier as 'Freemium' | 'Pro' | 'Corporate',
      type: body.type as string,
      initialAcademicYear: body.initialAcademicYear as string,
      calendarMode: body.calendarMode as 'Semester' | 'Trimester' | 'FullYear',
      includeSummer: body.includeSummer === true,
      adminEmail: body.adminEmail,
      adminName: body.adminName,
      adminUsername: body.adminUsername,
    });
    revalidatePath('/dashboard/provisions');
    revalidatePath('/dashboard/entity/portal');
    return result;
  } catch (e) { return asProvisioningApiFailure(e); }
});

export const OPTIONS = preflight;
