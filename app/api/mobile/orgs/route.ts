// GET /api/mobile/orgs: public directory of departments and organizations.

import { prisma } from '@/lib/prisma';
import { handler, preflight } from '@/lib/mobile/http';
import { toOrganization } from '@/lib/mobile/serialize';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const orgs = await prisma.organization.findMany({ orderBy: { name: 'asc' } });
  return orgs.map(toOrganization);
});

export const OPTIONS = preflight;
