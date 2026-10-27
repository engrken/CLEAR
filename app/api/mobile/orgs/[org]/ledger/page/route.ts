// Additive paginated officer ledger; must remain tenant/tab-overview scoped.
import { handler, preflight, ApiFailure } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { listLedgerPage } from '@/lib/mobile/ledger-page';
type Ctx = { params: Promise<{ org: string }> };
export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const { org } = await requireMobileOfficer(req, slug, 'tab-overview');
  const query = new URL(req.url).searchParams;
  const value = Number(query.get('limit') ?? 50);
  if (!Number.isSafeInteger(value)) throw new ApiFailure(400, 'invalid', 'Invalid page size.');
  const scope = query.get('scope') ?? 'all';
  if (scope !== 'active' && scope !== 'all') throw new ApiFailure(400, 'invalid', 'Invalid Activity scope.');
  return listLedgerPage(org, { limit: value, cursor: query.get('cursor'), scope });
});
export const OPTIONS = preflight;
