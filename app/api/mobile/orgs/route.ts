// GET /api/mobile/orgs: public directory of departments and organizations.
// The Play review `demo` org is listed only while its reviewer sign-in is on.

import { prisma } from '@/lib/prisma';
import { handler, preflight } from '@/lib/mobile/http';
import { toOrganization } from '@/lib/mobile/serialize';
import { DEMO_ORG_SLUG, isDemoReviewerEnabled } from '@/lib/demo-reviewer';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const orgs = await prisma.organization.findMany({
    where: isDemoReviewerEnabled() ? {} : { subdomain: { not: DEMO_ORG_SLUG } },
    orderBy: { name: 'asc' },
  });
  return orgs.map(toOrganization);
});

export const OPTIONS = preflight;
