// The web's global-admin tenant bypass, narrowed to a read-only mobile summary.
import { handler, preflight } from '@/lib/mobile/http';
import { requireGlobalMobileTenant } from '@/lib/mobile/global-tenant';
import { dashboardSummary } from '@/lib/mobile/data';
import { toOrganization } from '@/lib/mobile/serialize';

type Ctx = { params: Promise<{ org: string }> };

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const { org } = await requireGlobalMobileTenant(req, slug);
  const dashboard = await dashboardSummary(org);
  return {
    organization: { ...toOrganization(org), status: org.status },
    dashboard,
  };
});
export const OPTIONS = preflight;
