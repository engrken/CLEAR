// GET /api/mobile/orgs/:org/dashboard: treasury summary for the active term.

import { handler, preflight } from '@/lib/mobile/http';
import { dashboardSummary } from '@/lib/mobile/data';
import { requireMobileOfficer } from '@/lib/mobile/session';

type Ctx = { params: Promise<{ org: string }> };

export const GET = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const { org } = await requireMobileOfficer(req, slug, 'tab-overview');
  return dashboardSummary(org);
});

export const OPTIONS = preflight;
