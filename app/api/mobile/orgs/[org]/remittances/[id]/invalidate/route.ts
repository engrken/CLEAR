// POST /api/mobile/orgs/:org/remittances/:id/invalidate -> { ok: true }
// Rejects a pending payment proof (it moves to the Rejected tab on the web).

import { handler, preflight } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { invalidateOnlineRemittanceFor } from '@/lib/remittances';

type Ctx = { params: Promise<{ org: string; id: string }> };

export const POST = handler(async (req, { params }: Ctx) => {
  const { org: slug, id } = await params;
  const { officer, org } = await requireMobileOfficer(req, slug, 'tab-remittances');
  await invalidateOnlineRemittanceFor(org.id, officer.fullName, id);
  return { ok: true };
});

export const OPTIONS = preflight;
