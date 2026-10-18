// GET /api/mobile/orgs/:org/remittances/:id: one online remittance with its proof image.

import { handler, preflight } from '@/lib/mobile/http';
import { remittanceDetail } from '@/lib/mobile/data';
import { requireMobileOfficer } from '@/lib/mobile/session';

type Ctx = { params: Promise<{ org: string; id: string }> };

export const GET = handler(async (req, { params }: Ctx) => {
  const { org: slug, id } = await params;
  const { org } = await requireMobileOfficer(req, slug, 'tab-remittances');
  return remittanceDetail(org, id);
});

export const OPTIONS = preflight;
