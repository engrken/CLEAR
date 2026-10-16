// GET /api/mobile/orgs/:org: one department's public profile and active term.

import { handler, preflight } from '@/lib/mobile/http';
import { getOrgOr404 } from '@/lib/mobile/data';
import { toOrganization } from '@/lib/mobile/serialize';

type Ctx = { params: Promise<{ org: string }> };

export const GET = handler(async (_req, { params }: Ctx) => {
  const { org } = await params;
  return toOrganization(await getOrgOr404(org));
});

export const OPTIONS = preflight;
