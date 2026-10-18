// POST /api/mobile/orgs/:org/remittances/:id/verify
//   { orNumber, fundAllocation?, ay?, term? } -> { orNumber, lines }
// Accepts a pending payment proof and posts it as collection(s) under the
// officer's OR number (a package splits into OR, OR-P02, ...). Rules mirror Ken's
// verifyOnlineRemittance; see lib/mobile/remittances.ts. App 1.0.0 sends only
// orNumber and reads only orNumber; `lines` was added later.

import { ApiFailure, handler, preflight, readJson } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { verifyRemittance } from '@/lib/mobile/remittances';

type Ctx = { params: Promise<{ org: string; id: string }> };

function optionalField(value: unknown, field: string, max: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new ApiFailure(400, 'invalid', `${field} must be text.`);
  const s = value.trim();
  if (s.length > max) throw new ApiFailure(400, 'invalid', `${field} is too long.`);
  return s;
}

export const POST = handler(async (req, { params }: Ctx) => {
  const { org: slug, id } = await params;
  const { officer, org } = await requireMobileOfficer(req, slug, 'tab-remittances');
  const body = await readJson<{ orNumber: string; fundAllocation: string; ay: string; term: string }>(req);

  const orNumber = typeof body.orNumber === 'string' ? body.orNumber.trim().toUpperCase() : '';
  if (!orNumber) throw new ApiFailure(400, 'invalid', 'OR number is required.');
  // An empty fund string means "not chosen", as the 1.0.0 app never sends one.
  const fundAllocation = optionalField(body.fundAllocation, 'Fund', 120) || null;

  return verifyRemittance(org, officer, {
    remittanceId: id,
    orNumber,
    fundAllocation,
    ay: optionalField(body.ay, 'Academic year', 40) || null,
    term: optionalField(body.term, 'Term', 40) || null,
  });
});

export const OPTIONS = preflight;
