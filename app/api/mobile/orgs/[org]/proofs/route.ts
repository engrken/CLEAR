// POST /api/mobile/orgs/:org/proofs (multipart): a student's GCash / Maya / bank
// payment proof for the officer verification queue. Public; the student must be
// on the roster, and their name and email come from it.

import { prisma } from '@/lib/prisma';
import { ApiFailure, handler, json, preflight, requireCentavos, requireString } from '@/lib/mobile/http';
import { getOrgOr404 } from '@/lib/mobile/data';
import { toPesos } from '@/lib/mobile/serialize';
import { assertProofSubmissionAllowed, createOnlineRemittance, recordProofSubmission, MAX_PROOF_BYTES, proofFileToDataUrl } from '@/lib/remittances';
import { clientIp } from '@/lib/request-ip';

type Ctx = { params: Promise<{ org: string }> };

const CHANNELS = new Set(['GCash', 'Maya', 'Bank transfer']);

export const POST = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const org = await getOrgOr404(slug);
  const ip = clientIp(req.headers);
  await assertProofSubmissionAllowed(org.id, ip);

  const length = Number(req.headers.get('content-length') || 0);
  if (length > MAX_PROOF_BYTES + 64 * 1024) {
    throw new ApiFailure(413, 'payload_too_large', 'Payment proof image must be 4 MB or smaller.');
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiFailure(400, 'invalid', 'Send the proof as multipart/form-data.');
  }

  const schoolId = requireString(form.get('studentId'), 'Student ID', 60);
  const paymentChannel = requireString(form.get('paymentChannel'), 'Payment channel', 40);
  if (!CHANNELS.has(paymentChannel)) {
    throw new ApiFailure(400, 'invalid', 'Payment channel must be GCash, Maya or Bank transfer.');
  }
  const referenceNumber = requireString(form.get('referenceNumber'), 'Reference number', 80);
  const itemDescription = requireString(form.get('itemDescription'), 'Item', 200);
  const amountCentavos = requireCentavos(form.get('amountCentavos'), 'Amount');

  const file = form.get('proof');
  if (!(file instanceof File) || file.size === 0) {
    throw new ApiFailure(400, 'invalid', 'Attach a photo or screenshot of the payment.');
  }

  const student = await prisma.student.findFirst({
    where: { organizationId: org.id, studentId: { equals: schoolId, mode: 'insensitive' } },
  });
  if (!student) {
    throw new ApiFailure(422, 'invalid_student', 'Check your student ID. It must match the department roster.');
  }

  const { submissionId } = await createOnlineRemittance(org.id, {
    studentId: student.studentId,
    studentName: student.fullName,
    email: student.email,
    paymentChannel,
    referenceNo: referenceNumber,
    particulars: itemDescription,
    amount: toPesos(amountCentavos),
    proofDataUrl: await proofFileToDataUrl(file),
    ay: org.activeAy,
    term: org.activeTerm,
  });

  await recordProofSubmission(org.id, ip);
  return json(req, { submissionId }, 201);
});

export const OPTIONS = preflight;
