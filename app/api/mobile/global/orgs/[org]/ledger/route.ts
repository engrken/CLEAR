// Cross-tenant read-only financial activity uses the same web-derived ledger.
import { handler, preflight } from '@/lib/mobile/http';
import { requireGlobalMobileTenant } from '@/lib/mobile/global-tenant';
import { listLedger } from '@/lib/mobile/data';

type Ctx = { params: Promise<{ org: string }> };

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const { org } = await requireGlobalMobileTenant(req, slug);
  return listLedger(org, { limit: 100 });
});
export const OPTIONS = preflight;
