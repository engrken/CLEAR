// GET /api/mobile/orgs/:org/payments/next-or -> { suggestedOr }
// Suggested next official receipt number (YY-NNN) for the active A.Y., as Ken's
// Collections page computes it (collections/page.tsx). Officers with tab-payment.

import { handler, preflight } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { suggestNextOr } from '@/lib/mobile/payments';

type Ctx = { params: Promise<{ org: string }> };

export const GET = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const { org } = await requireMobileOfficer(req, slug, 'tab-payment');
  return { suggestedOr: await suggestNextOr(org), academicYear: org.activeAy };
});

export const OPTIONS = preflight;
