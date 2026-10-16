// GET /api/mobile/orgs/:org/fees: fee items for the active term (public).

import { handler, preflight } from '@/lib/mobile/http';
import { getOrgOr404, listFeeItems } from '@/lib/mobile/data';

type Ctx = { params: Promise<{ org: string }> };

export const GET = handler(async (_req, { params }: Ctx) => {
  const { org } = await params;
  return listFeeItems(await getOrgOr404(org));
});

export const OPTIONS = preflight;
