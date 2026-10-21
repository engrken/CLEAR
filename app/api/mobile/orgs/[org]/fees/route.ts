// GET /api/mobile/orgs/:org/fees: fee items for the active term (public), grouped
// the way Ken's Collections form offers them (see listMobileFeeItems).

import { handler, preflight } from '@/lib/mobile/http';
import { getOrgOr404 } from '@/lib/mobile/data';
import { listMobileFeeItems } from '@/lib/mobile/fee-items';

type Ctx = { params: Promise<{ org: string }> };

export const GET = handler(async (_req, { params }: Ctx) => {
  const { org } = await params;
  return listMobileFeeItems(await getOrgOr404(org));
});

export const OPTIONS = preflight;
