// GET /api/mobile/orgs/:org/ledger?status=&limit=: newest-first activity for the active term.

import { handler, preflight } from '@/lib/mobile/http';
import { listLedger } from '@/lib/mobile/data';
import { requireMobileOfficer } from '@/lib/mobile/session';

type Ctx = { params: Promise<{ org: string }> };

export const GET = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const { org } = await requireMobileOfficer(req, slug, 'tab-overview');
  const search = new URL(req.url).searchParams;
  return listLedger(org, {
    status: search.get('status'),
    limit: Number(search.get('limit')) || undefined,
  });
});

export const OPTIONS = preflight;
