// GET /api/mobile/orgs/:org: one department's public profile and active term,
// plus periodClosed when that term was closed (carried forward) on the web.

import { handler, preflight } from '@/lib/mobile/http';
import { getOrgOr404, isPeriodClosed } from '@/lib/mobile/data';
import { toOrganization } from '@/lib/mobile/serialize';

type Ctx = { params: Promise<{ org: string }> };

export const GET = handler(async (_req, { params }: Ctx) => {
  const { org } = await params;
  const found = await getOrgOr404(org);
  return {
    ...toOrganization(found),
    periodClosed: await isPeriodClosed(found.id, found.activeAy, found.activeTerm),
  };
});

export const OPTIONS = preflight;
