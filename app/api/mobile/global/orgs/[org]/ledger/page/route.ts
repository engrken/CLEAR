// Additive paginated global-tenant ledger; original /ledger remains an array.
import { handler, preflight, ApiFailure } from '@/lib/mobile/http';
import { requireGlobalMobileTenant } from '@/lib/mobile/global-tenant';
import { listLedgerPage } from '@/lib/mobile/ledger-page';
type Ctx = { params: Promise<{ org: string }> };
export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const { org } = await requireGlobalMobileTenant(req, slug);
  const query = new URL(req.url).searchParams;
  const value = Number(query.get('limit') ?? 50);
  if (!Number.isSafeInteger(value)) throw new ApiFailure(400, 'invalid', 'Invalid page size.');
  const scope = query.get('scope') ?? 'all';
  if (scope !== 'active' && scope !== 'all') throw new ApiFailure(400, 'invalid', 'Invalid Activity scope.');
  return listLedgerPage(org, { limit: value, cursor: query.get('cursor'), scope });
});
export const OPTIONS = preflight;
