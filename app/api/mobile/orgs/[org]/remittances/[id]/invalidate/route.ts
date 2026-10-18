// POST /api/mobile/orgs/:org/remittances/:id/invalidate -> { ok: true }
// Rejects a pending payment proof (Rejected tab on the web) and queues the
// rejection notice email. Rules mirror Ken's invalidateOnlineRemittance; see
// lib/mobile/remittances.ts.

import { handler, preflight } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { invalidateRemittance } from '@/lib/mobile/remittances';

type Ctx = { params: Promise<{ org: string; id: string }> };

export const POST = handler(async (req, { params }: Ctx) => {
  const { org: slug, id } = await params;
  const { officer, org } = await requireMobileOfficer(req, slug, 'tab-remittances');
  await invalidateRemittance(org, officer, id);
  return { ok: true };
});

export const OPTIONS = preflight;
