// POST /api/mobile/orgs/:org/proofs (multipart): a student's GCash / Maya / bank
// payment proof for the officer verification queue. Public; the student must be
// on the roster, and their name (and, unless sent, email) come from it.
//
// Fields (app 1.0.0): studentId, paymentChannel, referenceNumber, amountCentavos,
// itemDescription, proof (file). Optional (newer apps): email, paymentMode.
// Rules mirror Ken's submitOnlineRemittance; see lib/mobile/remittances.ts.

import { ApiFailure, handler, json, preflight, requireCentavos, requireString } from '@/lib/mobile/http';
import { getOrgOr404 } from '@/lib/mobile/data';
import { MAX_PROOF_BYTES, consumeProofAllowance, normalizeChannel, proofFileToDataUrl, submitProof } from '@/lib/mobile/remittances';
import { clientIp } from '@/lib/request-ip';

type Ctx = { params: Promise<{ org: string }> };

const optionalString = (value: FormDataEntryValue | null, max: number) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

export const POST = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const org = await getOrgOr404(slug);
  // Like Ken, every attempt counts toward the limit, before any parsing.
  await consumeProofAllowance(org.id, clientIp(req.headers));

  const length = Number(req.headers.get('content-length') || 0);
  if (length > MAX_PROOF_BYTES + 64 * 1024) {
    throw new ApiFailure(413, 'payload_too_large', 'Receipt image must not exceed 5MB.');
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiFailure(400, 'invalid', 'Send the proof as multipart/form-data.');
  }

  const schoolId = requireString(form.get('studentId'), 'Student ID', 60);
  const paymentChannel = normalizeChannel(requireString(form.get('paymentChannel'), 'Payment channel', 40));
  if (!paymentChannel) {
    throw new ApiFailure(400, 'invalid', 'Payment channel must be GCash, Maya or Bank Transfer.');
  }
  const referenceNumber = requireString(form.get('referenceNumber'), 'Reference number', 100);
  const itemDescription = requireString(form.get('itemDescription'), 'Item', 200);
  const amountCentavos = requireCentavos(form.get('amountCentavos'), 'Amount');
  const email = optionalString(form.get('email'), 254);
  const paymentMode = optionalString(form.get('paymentMode'), 30);
  const proofDataUrl = await proofFileToDataUrl(form.get('proof'));

  const { submissionId } = await submitProof(org, {
    schoolId,
    paymentChannel,
    referenceNumber,
    itemDescription,
    amountCentavos,
    email,
    paymentMode,
    proofDataUrl,
  });

  return json(req, { submissionId }, 201);
});

export const OPTIONS = preflight;
