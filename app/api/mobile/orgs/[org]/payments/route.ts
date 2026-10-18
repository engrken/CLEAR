// POST /api/mobile/orgs/:org/payments { studentId, feeId, amountCentavos, orNumber, penaltyId? } -> LedgerEntry
// Records an in-person payment with Ken's Collections rules (lib/mobile/payments.ts
// mirrors collections/actions.ts recordPayment).
//
// feeId is a CollectionSetup id from GET /fees, or the package pseudo-item's
// `package:<id>`. penaltyId (added after app 1.0.0) settles a penalty instead;
// feeId is then not needed. The response is the first receipt line as a
// LedgerEntry (1.0.0 shape) plus receipt details (added fields).

import { ApiFailure, handler, json, preflight, readJson, requireCentavos, requireString } from '@/lib/mobile/http';
import { collectionEntry } from '@/lib/mobile/data';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { recordMobilePayment } from '@/lib/mobile/payments';

type Ctx = { params: Promise<{ org: string }> };

type Body = { studentId: string; feeId: string; amountCentavos: number; orNumber: string; penaltyId: string };

export const POST = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const { officer, org } = await requireMobileOfficer(req, slug, 'tab-payment');

  const body = await readJson<Body>(req);
  const studentId = requireString(body.studentId, 'Student', 64);
  const penaltyId = typeof body.penaltyId === 'string' && body.penaltyId.trim()
    ? requireString(body.penaltyId, 'Penalty', 64)
    : undefined;
  const feeId = penaltyId && !body.feeId ? undefined : requireString(body.feeId, 'Fee item', 80);
  const amountCentavos = requireCentavos(body.amountCentavos, 'Amount');
  const orNumber = requireString(body.orNumber, 'OR number', 60).toUpperCase();

  const result = await recordMobilePayment(org, officer, { studentId, feeId, penaltyId, amountCentavos, orNumber });
  if (!result.firstReceipt) throw new ApiFailure(500, 'server_error', 'The receipt was not created.');

  return json(req, {
    // 1.0.0 LedgerEntry fields. A package receipt's amount is the whole OR (all lines).
    ...collectionEntry(result.firstReceipt),
    subtitle: result.itemDescription,
    amountCentavos: result.amountCentavos,
    // Added after 1.0.0.
    orNumber: result.orNumber,
    paymentType: result.paymentType,
    balanceDueCentavos: result.balanceDueCentavos,
    lines: result.lines,
  }, 201);
});

export const OPTIONS = preflight;
