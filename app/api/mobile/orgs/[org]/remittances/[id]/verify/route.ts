// POST /api/mobile/orgs/:org/remittances/:id/verify { orNumber, fundAllocation? } -> { orNumber }
// Accepts a pending payment proof and posts it as a collection under the officer's OR number.

import { handler, preflight, readJson, requireString } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { verifyOnlineRemittanceFor } from '@/lib/remittances';

type Ctx = { params: Promise<{ org: string; id: string }> };

export const POST = handler(async (req, { params }: Ctx) => {
  const { org: slug, id } = await params;
  const { officer, org } = await requireMobileOfficer(req, slug, 'tab-remittances');
  const body = await readJson<{ orNumber: string; fundAllocation: string }>(req);
  const orNumber = requireString(body.orNumber, 'OR number', 40).toUpperCase();
  const fundAllocation = typeof body.fundAllocation === 'string' ? body.fundAllocation.trim().slice(0, 120) : null;

  return verifyOnlineRemittanceFor(org.id, officer.fullName, { remittanceId: id, orNumber, fundAllocation });
});

export const OPTIONS = preflight;
