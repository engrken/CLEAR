// /lib/remittances.ts
//
// Online remittances (GCash / Maya / bank proofs): public submission and the
// officer verification queue. Shared by the web server actions and the mobile
// API. No authorization here: callers pass an organization they have already
// checked access to.

import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { logSystemAction } from '@/lib/logger';
import { DomainError, isUniqueViolation } from '@/lib/errors';
import { countRateLimitedAction, isRateLimited } from '@/lib/auth-throttle';

// Payment-proof uploads: images only, capped in size (validated server-side;
// a client's accept="image/*" is only a hint).
export const MAX_PROOF_BYTES = 4 * 1024 * 1024;
export const PROOF_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

// Public submissions per department and client IP.
export const PROOF_SUBMISSIONS_PER_WINDOW = 5;
export const PROOF_SUBMISSION_WINDOW_MS = 10 * 60 * 1000;

const proofKey = (organizationId: string, ip: string) => `proof:${organizationId}:${ip}`;

/** Throws once a client has submitted too many proofs to this department recently. */
export async function assertProofSubmissionAllowed(organizationId: string, ip: string) {
  if (await isRateLimited(proofKey(organizationId, ip), PROOF_SUBMISSIONS_PER_WINDOW, PROOF_SUBMISSION_WINDOW_MS)) {
    throw new DomainError('Too many payment proofs from your network. Please wait 10 minutes and try again.', 'rate_limited');
  }
}

/** Counts a successfully queued proof toward the client's limit. */
export async function recordProofSubmission(organizationId: string, ip: string) {
  await countRateLimitedAction(proofKey(organizationId, ip), PROOF_SUBMISSION_WINDOW_MS);
}

function generateReference(prefix: string): string {
  const randomStr = crypto.randomBytes(4).toString('hex').toUpperCase();
  const timestamp = Date.now().toString().slice(-4);
  return `${prefix}-${randomStr}-${timestamp}`;
}

function toMoney(val: unknown, fieldName: string): number {
  const parsed = parseFloat(String(val));
  if (isNaN(parsed)) throw new DomainError(`Invalid monetary value for ${fieldName}`, 'invalid');
  return Math.round(parsed * 100) / 100;
}

/** Validates an uploaded image and returns it as a data URL (the current storage format). */
export async function proofFileToDataUrl(file: File | null | undefined): Promise<string | null> {
  if (!file || file.size === 0) return null;
  if (!PROOF_MIME_TYPES.has(file.type)) {
    throw new DomainError('Payment proof must be a PNG, JPEG, WebP or GIF image.', 'invalid');
  }
  if (file.size > MAX_PROOF_BYTES) {
    throw new DomainError('Payment proof image must be 4 MB or smaller.', 'payload_too_large');
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString('base64')}`;
}

export function validateProofDataUrl(dataUrl: string | null | undefined): string | null {
  if (!dataUrl) return null;
  const match = /^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(dataUrl));
  if (!match || !PROOF_MIME_TYPES.has(match[1].toLowerCase())) {
    throw new DomainError('Payment proof must be a PNG, JPEG, WebP or GIF image.', 'invalid');
  }
  const bytes = Buffer.byteLength(match[2].replace(/\s/g, ''), 'base64');
  if (bytes > MAX_PROOF_BYTES) {
    throw new DomainError('Payment proof image must be 4 MB or smaller.', 'payload_too_large');
  }
  return dataUrl;
}

/** Only submissions still in the queue can be verified or invalidated (matches the web queue). */
function isPending(status: string | null | undefined) {
  const st = String(status || '').trim();
  return !st || st.toLowerCase().includes('pending');
}

export async function resolveStudentDbId(orgId: string, identifier: string | null) {
  if (!identifier) return null;
  const student =
    (await prisma.student.findFirst({ where: { id: identifier, organizationId: orgId } })) ||
    (await prisma.student.findFirst({ where: { studentId: identifier, organizationId: orgId } }));
  return student ? student.id : null;
}

export type OnlineRemittanceInput = {
  studentId: string | null;
  studentName: string;
  email: string | null;
  paymentChannel: string;
  referenceNo: string;
  particulars: string;
  amount: number;
  proofDataUrl: string | null;
  ay: string;
  term: string;
};

/** Records a public payment-proof submission in the verification queue. */
export async function createOnlineRemittance(organizationId: string, input: OnlineRemittanceInput) {
  const proofUrl = validateProofDataUrl(input.proofDataUrl);

  // The student must be on this department's roster (matched by school ID).
  const schoolId = String(input.studentId || '').trim();
  if (!schoolId) throw new DomainError('Student ID is required.', 'invalid');
  const student = await prisma.student.findFirst({
    where: { organizationId, studentId: { equals: schoolId, mode: 'insensitive' } },
  });
  if (!student) {
    throw new DomainError(
      `Student ID "${schoolId}" is not registered under this department. Please check your student ID.`,
      'invalid_student'
    );
  }

  const studentName = String(input.studentName || '').trim() || student.fullName;
  const referenceNumber = String(input.referenceNo || '').trim();
  if (!studentName || !referenceNumber) {
    throw new DomainError('Student name and payment reference number are required.', 'invalid');
  }

  const amount = toMoney(input.amount, 'Online remittance amount');
  if (amount <= 0) throw new DomainError('Amount must be greater than zero.', 'invalid');

  const email = String(input.email || student.email || '').trim().toLowerCase() || null;
  const submissionId = generateReference('SUB');

  await prisma.onlineRemittance.create({
    data: {
      organizationId,
      submissionId,
      academicYear: input.ay,
      term: input.term,
      studentId: student.studentId,
      studentName,
      studentEmail: email,
      paymentChannel: String(input.paymentChannel || '').trim(),
      referenceNumber,
      category: 'Online Remittance',
      itemDescription: String(input.particulars || '').trim(),
      paymentMode: 'Online',
      amountPaid: amount,
      proofUrl,
      status: 'Pending Verification',
    },
  });

  await logSystemAction(
    organizationId,
    'Public Submission',
    'SUBMIT_REMITTANCE',
    `Received ₱${amount.toFixed(2)} online payment proof from ${studentName} via ${input.paymentChannel}.`
  );

  return { submissionId };
}

/**
 * Fund a verified remittance is credited to when the officer doesn't choose one:
 * the matching fee item's target fund, else the term's first fund.
 */
export async function defaultFundFor(organizationId: string, itemDescription: string, ay: string, term: string) {
  const setup = await prisma.collectionSetup.findFirst({
    where: { organizationId, academicYear: ay, term, name: { equals: itemDescription.trim(), mode: 'insensitive' } },
  });
  if (setup?.targetFund) return setup.targetFund;
  const fund = await prisma.fund.findFirst({ where: { organizationId, academicYear: ay, term }, orderBy: { fundName: 'asc' } });
  return fund?.fundName || 'General Fund (Carried Over)';
}

/** Verifies a pending remittance and posts it as a collection under `orNumber`. */
export async function verifyOnlineRemittanceFor(
  organizationId: string,
  officerName: string,
  data: { remittanceId: string; orNumber: string; fundAllocation?: string | null }
) {
  const orNumber = String(data.orNumber || '').trim();
  if (!orNumber) throw new DomainError('OR number is required.', 'invalid');

  try {
    await prisma.$transaction(async (tx) => {
      const remittance = await tx.onlineRemittance.findFirst({
        where: { id: data.remittanceId, organizationId },
      });

      if (!remittance) throw new DomainError('Online remittance record not found.', 'not_found');
      if (String(remittance.status || '').toUpperCase() === 'VERIFIED') {
        throw new DomainError('This remittance has already been verified.', 'conflict');
      }
      if (!isPending(remittance.status)) {
        throw new DomainError(`This remittance is ${remittance.status} and can no longer be verified.`, 'conflict');
      }

      const amount = Math.max(0, Number(remittance.amountPaid) || 0);
      if (amount <= 0) throw new DomainError('The remittance contains an invalid amount.', 'invalid');

      const studentDbId = await resolveStudentDbId(organizationId, remittance.studentId);
      const itemDescription = remittance.itemDescription || 'Online Payment';
      const fundAllocation =
        String(data.fundAllocation || '').trim() ||
        (await defaultFundFor(organizationId, itemDescription, remittance.academicYear, remittance.term));

      await tx.onlineRemittance.update({
        where: { id: remittance.id },
        data: { status: 'Verified', reviewedBy: officerName, orNumber },
      });

      await tx.collection.create({
        data: {
          organizationId,
          academicYear: remittance.academicYear,
          term: remittance.term,
          date: new Date(),
          studentId: studentDbId,
          studentName: remittance.studentName,
          orNumber,
          category: remittance.category || 'Online Remittance',
          itemDescription,
          paymentType: 'Full Payment',
          standardRate: amount,
          amountPaid: amount,
          balanceDue: 0,
          fundAllocation,
          status: 'Valid',
          encodedBy: officerName,
        },
      });
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new DomainError(`OR number ${orNumber} is already used for this item.`, 'duplicate_or');
    }
    throw err;
  }

  await logSystemAction(
    organizationId,
    officerName,
    'VERIFY_REMITTANCE',
    `Verified online remittance [${data.remittanceId}] and issued OR: ${orNumber}.`
  );

  return { orNumber };
}

export async function invalidateOnlineRemittanceFor(organizationId: string, officerName: string, remittanceId: string) {
  const remittance = await prisma.onlineRemittance.findFirst({
    where: { id: remittanceId, organizationId },
  });

  if (!remittance) throw new DomainError('Online remittance record not found.', 'not_found');
  if (String(remittance.status || '').toUpperCase() === 'VERIFIED') {
    throw new DomainError('A verified remittance cannot be invalidated from the pending queue.', 'conflict');
  }
  if (!isPending(remittance.status)) {
    throw new DomainError(`This remittance is already ${remittance.status}.`, 'conflict');
  }

  await prisma.onlineRemittance.update({
    where: { id: remittance.id },
    data: {
      status: 'Rejected',
      reviewedBy: officerName,
      reviewNotes: 'Marked invalid and removed from queue by admin.',
    },
  });

  await logSystemAction(
    organizationId,
    officerName,
    'INVALIDATE_REMITTANCE',
    `Invalidated remittance [Ref: ${remittance.referenceNumber}] from ${remittance.studentName}.`
  );
}
