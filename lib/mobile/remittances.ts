// /lib/mobile/remittances.ts
//
// Online remittances for the mobile API: a student's public payment proof, and
// an officer verifying or rejecting it. The business rules MIRROR Ken's server
// actions in app/department/[department]/(protected)/remittances/actions.ts,
// which can't be called from a route handler (they read the next-auth session,
// requireTabAccess and headers()). Keep these in sync with that file:
//
//   verifyRemittance      <- verifyOnlineRemittance
//   invalidateRemittance  <- invalidateOnlineRemittance
//   submitProof           <- submitOnlineRemittance (validation, roster, rollover, duplicate)
//   consumeProofAllowance <- the IP throttle at the top of submitOnlineRemittance
//
// Ken's exported helpers are reused as-is: assertAcademicPeriod, getPeriodLedger,
// toCents, applyPaymentToStudentCollectibles, enqueuePaymentReceipt,
// enqueueAccountingNotice, scheduleDigitalReceiptDispatch, logSystemAction.
//
// Deliberate differences (mobile only):
//   - Proofs go to the org's ACTIVE period, not a client-supplied A.Y./term, and
//     also pass assertAcademicPeriod.
//   - The throttle key uses the LAST X-Forwarded-For entry (lib/request-ip.ts)
//     and is updated in one atomic SQL statement.
//   - The proof's MIME type comes from its magic bytes, not the client's label.
//   - The duplicate-reference check and the insert run in one Serializable
//     transaction, and the check ignores letter case.
//   - The 1.0.0 app sends no fund when verifying; we then use the fund the web
//     queue preselects (first non-negative ledger fund).
//   - Ken's plain Error throws become DomainError so the API answers 4xx, not 500.

import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type Organization, type TenantUser } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { logSystemAction } from '@/lib/logger';
import { DomainError, isUniqueViolation, type DomainErrorCode } from '@/lib/errors';
import { isOrganizationActive } from '@/lib/roles';
import { assertAcademicPeriod } from '@/lib/academic-period-guard';
import { enqueueAccountingNotice, enqueuePaymentReceipt, scheduleDigitalReceiptDispatch } from '@/lib/digital-receipts';
import { getPeriodLedger, toCents } from '@/app/department/[department]/(protected)/realign/ledger';
import { applyPaymentToStudentCollectibles } from '@/app/department/[department]/(protected)/collectibles/due-link';

// ---------------------------------------------------------------- shared

// Same limits as Ken's SECURITY CONFIGURATIONS FOR PUBLIC SUBMISSION.
export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
export const PROOF_SUBMISSIONS_PER_WINDOW = 5;
export const PROOF_SUBMISSION_WINDOW_MS = 10 * 60 * 1000;

const PENDING = ['PENDING', 'PENDING VERIFICATION'];
const isPending = (status: unknown) => PENDING.includes(String(status || '').toUpperCase());
const LEGACY_DEFAULT_FUND = 'General Fund (Carried Over)';
const PACKAGE_SPLIT_LABEL = 'Multiple Funds (Package Split)';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OR_RE = /^[A-Z0-9][A-Z0-9-]{2,50}$/;

/** Mirrors money() in Ken's remittances/actions.ts. */
function money(val: unknown, fieldName: string): number {
  const parsed = Number(val);
  if (!Number.isFinite(parsed) || parsed <= 0 || Math.abs(parsed * 100 - Math.round(parsed * 100)) > 0.000001) {
    throw new DomainError(`${fieldName} must be a positive amount with two decimal places or fewer.`, 'invalid');
  }
  return Math.round(parsed * 100) / 100;
}

/** Mirrors generateReference() in Ken's remittances/actions.ts. */
function generateReference(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 12).toUpperCase()}`;
}

/** Runs one of Ken's helpers and turns its plain Error into a DomainError (else the API would answer 500). */
async function kenRule<T>(code: DomainErrorCode, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Error && !(err instanceof DomainError) && !('code' in err)) {
      throw new DomainError(err.message, code);
    }
    throw err;
  }
}

/** Serializable transactions abort on concurrent writes (P2034); tell the client to retry. */
function mapTxError(err: unknown, orNumber?: string): never {
  const code = (err as { code?: string } | null)?.code;
  if (code === 'P2034') {
    throw new DomainError('Another change was saved at the same time. Refresh and try again.', 'conflict');
  }
  if (orNumber && isUniqueViolation(err)) {
    throw new DomainError(`Official receipt ${orNumber} already exists.`, 'duplicate_or');
  }
  throw err;
}

function revalidateDepartment(subdomain: string, routes: string[]) {
  try {
    for (const route of routes) revalidatePath(`/department/${subdomain}/${route}`);
    revalidatePath(`/department/${subdomain}`);
  } catch {
    // Cache revalidation is best effort outside a request scope.
  }
}

// ---------------------------------------------------------------- public proof

// What the app may send -> Ken's spelling (ClearanceClientView.tsx options).
// App 1.0.0 sends "Bank transfer".
const CHANNELS: Record<string, string> = {
  gcash: 'GCash',
  maya: 'Maya',
  paymaya: 'Maya',
  'bank transfer': 'Bank Transfer',
};

/** Ken's channel spelling, or null for a channel the queue doesn't take. */
export function normalizeChannel(raw: unknown): string | null {
  const key = String(raw ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  return CHANNELS[key] ?? null;
}

/**
 * Counts one proof attempt from this client against the org's limit and throws
 * once it is over. Mirrors the AuthThrottle block in submitOnlineRemittance:
 * every attempt counts (accepted or not, which also limits roster probing),
 * 5 per 10-minute fixed window, IP hashed with the org id. Unlike Ken's
 * read-then-write, the count is updated in a single statement so concurrent
 * requests can't slip past the limit. The "proof:" prefix is what the test
 * helpers clear.
 */
export async function consumeProofAllowance(organizationId: string, ip: string) {
  const ipHash = createHash('sha256').update(`${organizationId}|${String(ip || 'unknown').slice(0, 64)}`).digest('hex').slice(0, 32);
  const key = `proof:${organizationId}:${ipHash}`;
  const now = new Date();
  const nowIso = now.toISOString();
  const windowStartIso = new Date(now.getTime() - PROOF_SUBMISSION_WINDOW_MS).toISOString();
  // AuthThrottle.lastSentAt / updatedAt are timestamp(3) without time zone holding
  // UTC (Prisma's convention); convert explicitly so the session time zone can't
  // shift them. updatedAt has no @updatedAt in Ken's schema, so it is set here.
  const rows = await prisma.$queryRaw<{ failedCount: number }[]>`
    INSERT INTO "AuthThrottle" ("key", "failedCount", "lastSentAt", "updatedAt")
    VALUES (${key}, 1, (${nowIso}::timestamptz AT TIME ZONE 'UTC'), (${nowIso}::timestamptz AT TIME ZONE 'UTC'))
    ON CONFLICT ("key") DO UPDATE SET
      "failedCount" = CASE
        WHEN "AuthThrottle"."lastSentAt" > (${windowStartIso}::timestamptz AT TIME ZONE 'UTC') THEN "AuthThrottle"."failedCount" + 1
        ELSE 1 END,
      "lastSentAt" = CASE
        WHEN "AuthThrottle"."lastSentAt" > (${windowStartIso}::timestamptz AT TIME ZONE 'UTC') THEN "AuthThrottle"."lastSentAt"
        ELSE EXCLUDED."lastSentAt" END,
      "updatedAt" = EXCLUDED."updatedAt"
    RETURNING "failedCount"`;
  if (Number(rows[0]?.failedCount ?? 0) > PROOF_SUBMISSIONS_PER_WINDOW) {
    throw new DomainError(
      'Too many payment proof submissions from your network. Please wait 10 minutes before trying again.',
      'rate_limited'
    );
  }
}

function sniffImageType(bytes: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

/**
 * Validates an uploaded proof (PNG / JPEG / WebP by magic bytes, at most 5 MB)
 * and returns it as a base64 data URL, the storage format of OnlineRemittance.proofUrl.
 */
export async function proofFileToDataUrl(file: unknown): Promise<string> {
  if (!(file instanceof File) || file.size === 0) {
    throw new DomainError('Attach a photo or screenshot of the payment.', 'invalid');
  }
  if (file.size > MAX_PROOF_BYTES) {
    throw new DomainError('Receipt image must not exceed 5MB.', 'payload_too_large');
  }
  const declared = String(file.type || '').toLowerCase();
  if (declared && declared !== 'application/octet-stream' && !declared.startsWith('image/')) {
    throw new DomainError('Invalid file format. Only JPEG, PNG, and WebP receipt images are permitted.', 'invalid');
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_PROOF_BYTES) {
    throw new DomainError('Receipt image must not exceed 5MB.', 'payload_too_large');
  }
  const type = sniffImageType(bytes);
  if (!type) throw new DomainError('File is not a valid PNG, JPEG, or WebP image.', 'invalid');
  return `data:${type};base64,${bytes.toString('base64')}`;
}

export type ProofInput = {
  schoolId: string;
  paymentChannel: string; // already normalized
  referenceNumber: string;
  itemDescription: string;
  amountCentavos: number;
  email: string | null; // optional; the roster email is used when absent
  paymentMode: string | null;
  proofDataUrl: string;
};

/** Mirrors submitOnlineRemittance (after its throttle). Returns the new submission id. */
export async function submitProof(org: Organization, input: ProofInput) {
  if (!isOrganizationActive(org)) {
    throw new DomainError('This department is not accepting payment proofs right now.', 'not_found');
  }
  const amount = money(input.amountCentavos / 100, 'Online remittance amount');
  const referenceNumber = String(input.referenceNumber || '').trim();
  if (!input.paymentChannel || !referenceNumber || referenceNumber.length > 100) {
    throw new DomainError('Payment channel and reference number are required.', 'invalid');
  }
  const targetStudentId = String(input.schoolId || '').trim();
  if (!targetStudentId) throw new DomainError('Student ID is required.', 'invalid');

  const student = await prisma.student.findFirst({
    where: { organizationId: org.id, studentId: { equals: targetStudentId, mode: 'insensitive' } },
  });
  if (!student) {
    throw new DomainError(
      `Student ID "${targetStudentId}" is not registered under this department. Please verify your student ID.`,
      'invalid_student'
    );
  }

  // Ken requires a valid notification email; the app sends none, so use the roster's.
  const cleanEmail = String(input.email || student.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 254) {
    throw new DomainError(
      input.email
        ? 'Please provide a valid notification email address.'
        : 'Your student record has no valid email address. Ask your department to update it, then try again.',
      'invalid'
    );
  }

  const ay = org.activeAy;
  const term = org.activeTerm;
  await kenRule('conflict', () => assertAcademicPeriod(prisma, org.id, ay, term));
  const ledger = await getPeriodLedger(prisma, org.id, ay, term);
  if (ledger.activeRollover) {
    throw new DomainError('The selected term has been closed; new proof submissions are unavailable.', 'conflict');
  }

  const submissionId = generateReference('SUB');
  try {
    await prisma.$transaction(
      async (tx) => {
        const duplicate = await tx.onlineRemittance.findFirst({
          where: {
            organizationId: org.id,
            paymentChannel: { equals: input.paymentChannel, mode: 'insensitive' },
            referenceNumber: { equals: referenceNumber, mode: 'insensitive' },
            status: { in: ['Pending', 'Pending Verification', 'Verified'] },
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new DomainError('This payment reference has already been submitted for verification.', 'conflict');
        }
        await tx.onlineRemittance.create({
          data: {
            organizationId: org.id,
            submissionId,
            academicYear: ay,
            term,
            studentId: student.studentId,
            studentName: student.fullName,
            studentEmail: cleanEmail,
            paymentChannel: input.paymentChannel,
            referenceNumber,
            category: 'Online Remittance',
            itemDescription: String(input.itemDescription || '').trim().slice(0, 200),
            paymentMode: String(input.paymentMode || 'Online').slice(0, 30),
            amountPaid: amount,
            proofUrl: input.proofDataUrl,
            status: 'Pending Verification',
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (err) {
    mapTxError(err);
  }

  await logSystemAction(
    org.id,
    'Public Submission',
    'SUBMIT_REMITTANCE',
    `Received ₱${amount.toFixed(2)} online payment proof from registered student ${student.studentId} via ${input.paymentChannel}.`
  );
  revalidateDepartment(org.subdomain, ['remittances', 'clearance']);

  return { submissionId };
}

// ---------------------------------------------------------------- officer review

type Officer = Pick<TenantUser, 'fullName' | 'email'>;
const officerNameOf = (o: Officer) => String(o.fullName || o.email || 'Officer');

export type VerifyInput = {
  remittanceId: string;
  orNumber: string; // trimmed + upper-cased by the caller
  fundAllocation: string | null; // null: the web queue's preselected fund
  ay?: string | null; // optional guard: the period the officer was looking at
  term?: string | null;
};

export type VerifiedLine = {
  orNumber: string;
  itemDescription: string;
  fundAllocation: string;
  paymentType: string;
  amountCentavos: number;
  balanceCentavos: number;
};

/** Mirrors verifyOnlineRemittance. */
export async function verifyRemittance(org: Organization, officer: Officer, data: VerifyInput) {
  const officerName = officerNameOf(officer);
  const orNumber = String(data.orNumber || '').trim().toUpperCase();
  if (!OR_RE.test(orNumber)) throw new DomainError('A valid OR number is required.', 'invalid');
  const requestedFund = data.fundAllocation === null ? null : String(data.fundAllocation || '').trim();
  if (requestedFund !== null && (!requestedFund || requestedFund === PACKAGE_SPLIT_LABEL)) {
    throw new DomainError('A valid fund is required.', 'invalid');
  }

  const lines: VerifiedLine[] = [];
  try {
    await prisma.$transaction(
      async (tx) => {
        const remit = await tx.onlineRemittance.findFirst({ where: { id: data.remittanceId, organizationId: org.id } });
        if (!remit) throw new DomainError('Online submission was not found in this organization.', 'not_found');
        if (!isPending(remit.status)) {
          throw new DomainError('This submission was already reviewed. Refresh the queue.', 'conflict');
        }
        if ((data.ay && remit.academicYear !== data.ay) || (data.term && remit.term !== data.term)) {
          throw new DomainError('Submission academic period does not match the page. Refresh before verifying.', 'conflict');
        }
        await kenRule('conflict', () => assertAcademicPeriod(tx, org.id, remit.academicYear, remit.term));
        const ledger = await getPeriodLedger(tx, org.id, remit.academicYear, remit.term);
        if (ledger.activeRollover) {
          throw new DomainError('This term has been carried forward and cannot accept verified payments.', 'conflict');
        }
        const conflicted = await tx.collection.findFirst({ where: { organizationId: org.id, orNumber }, select: { id: true } });
        if (conflicted) throw new DomainError(`Official receipt ${orNumber} already exists.`, 'duplicate_or');

        const student = await tx.student.findFirst({
          where: { organizationId: org.id, studentId: { equals: String(remit.studentId || '').trim(), mode: 'insensitive' } },
        });
        if (!student) throw new DomainError('This payment cannot be linked to a registered student.', 'invalid_student');
        const amount = money(remit.amountPaid, 'Submitted amount');
        const itemDescription = String(remit.itemDescription || 'Online Payment').trim();
        if (/^Penalty Fine\s*(?:\[|:)/i.test(itemDescription) || /^penalt(?:y|ies)$/i.test(String(remit.category || '').trim())) {
          throw new DomainError(
            'Penalty remittances need a linked penalty ID and an atomic balance adjustment. Use Penalty Logs → Pay in Cash; do not verify this as a generic fee.',
            'invalid'
          );
        }

        // The web queue preselects the first non-negative ledger fund, else the
        // period's first fund (remittances/page.tsx); app 1.0.0 sends no fund.
        let fundAllocation = requestedFund;
        if (fundAllocation === null) {
          fundAllocation = ledger.funds.find((f) => f.balance >= 0)?.name || null;
          if (!fundAllocation) {
            const fund = await tx.fund.findFirst({
              where: { organizationId: org.id, academicYear: remit.academicYear, term: remit.term },
            });
            fundAllocation = fund?.fundName || LEGACY_DEFAULT_FUND;
          }
        }

        const isPackage = /departmental\s+fee.*package|departmental.*package/i.test(itemDescription);
        // The officer may select only an actual ledger fund for this period;
        // arbitrary names would create untracked fund allocations.
        if (!isPackage && (!fundAllocation ||
          !ledger.funds.some((fund) => fund.name.trim().toLowerCase() === fundAllocation!.toLowerCase()))) {
          throw new DomainError('Selected fund is not available in this academic term.', 'invalid');
        }
        const packageItems = isPackage
          ? await tx.collectionSetup.findMany({
              where: { organizationId: org.id, academicYear: remit.academicYear, term: remit.term, isPackage: true },
              orderBy: [{ category: 'asc' }, { name: 'asc' }],
            })
          : [];
        const setup = !isPackage
          ? await tx.collectionSetup.findFirst({
              where: { organizationId: org.id, academicYear: remit.academicYear, term: remit.term, name: itemDescription },
            })
          : null;
        const prior = await tx.collection.findMany({
          where: { organizationId: org.id, academicYear: remit.academicYear, term: remit.term, studentId: student.id },
        });
        const goodPrior = prior.filter(
          (c) =>
            !String(c.status || '').toUpperCase().includes('VOID') &&
            !String(c.paymentType || '').toUpperCase().includes('VOID') &&
            !String(c.status || '').toUpperCase().includes('CANCEL')
        );
        const previouslyPaid = (name: string) =>
          goodPrior
            .filter((c) => String(c.itemDescription || '').trim().toLowerCase() === name.toLowerCase())
            .reduce((sum, c) => sum + toCents(c.amountPaid), 0);
        const amountCents = toCents(amount);
        const entries: { name: string; fund: string; rate: number; amount: number; balance: number; category: string }[] = [];

        if (isPackage && packageItems.length) {
          let legacyCredit =
            previouslyPaid('Departmental Fee (Full Package)') + previouslyPaid('Departmental Fee Package (All Items)');
          let leftToAllocate = amountCents;
          for (const item of packageItems) {
            const rate = toCents(item.amount);
            const previous = previouslyPaid(String(item.name));
            const availableBeforeLegacy = Math.max(0, rate - previous);
            const legacyApplied = Math.min(legacyCredit, availableBeforeLegacy);
            legacyCredit -= legacyApplied;
            const available = availableBeforeLegacy - legacyApplied;
            const piece = Math.min(leftToAllocate, available);
            if (piece > 0) {
              const fund = String(item.targetFund || '').trim();
              if (!fund) throw new DomainError(`Package fee ${item.name} is missing a target fund.`, 'conflict');
              entries.push({ name: String(item.name), fund, rate, amount: piece, balance: available - piece, category: String(item.category) });
              leftToAllocate -= piece;
            }
          }
          if (leftToAllocate !== 0 || entries.length === 0) {
            throw new DomainError(
              "The verified remittance exceeds the student's remaining departmental package assessment.",
              'conflict'
            );
          }
        } else {
          const previous = previouslyPaid(itemDescription);
          const rate = setup ? toCents(setup.amount) : previous + amountCents;
          if (setup && previous + amountCents > rate) {
            throw new DomainError(`Payment exceeds the outstanding ${itemDescription} assessment. Review before verifying.`, 'conflict');
          }
          entries.push({
            name: itemDescription,
            fund: String(setup?.targetFund || fundAllocation),
            rate,
            amount: amountCents,
            balance: Math.max(0, rate - previous - amountCents),
            category: String(remit.category || 'Online Remittance'),
          });
        }

        const existingOr = await tx.collection.findFirst({
          where: { organizationId: org.id, OR: [{ orNumber }, { orNumber: { startsWith: `${orNumber}-P` } }] },
          select: { id: true },
        });
        if (existingOr) throw new DomainError(`Official receipt ${orNumber} or its package lines already exist.`, 'duplicate_or');
        const updated = await tx.onlineRemittance.updateMany({
          where: { id: remit.id, organizationId: org.id, status: remit.status },
          data: { status: 'Verified', reviewedBy: officerName, orNumber },
        });
        if (updated.count !== 1) throw new DomainError('Submission was already processed by another officer.', 'conflict');
        for (const [index, entry] of entries.entries()) {
          const lineOr = index === 0 ? orNumber : `${orNumber}-P${String(index + 1).padStart(2, '0')}`;
          const paymentType = entry.balance === 0 ? 'Full Payment' : 'Partial Payment';
          await tx.collection.create({
            data: {
              organizationId: org.id,
              academicYear: remit.academicYear,
              term: remit.term,
              date: new Date(),
              studentId: student.id,
              studentName: student.fullName,
              orNumber: lineOr,
              category: entry.category,
              itemDescription: entry.name,
              paymentType,
              standardRate: entry.rate / 100,
              amountPaid: entry.amount / 100,
              balanceDue: entry.balance / 100,
              fundAllocation: entry.fund,
              status: 'Valid',
              encodedBy: officerName,
            },
          });
          lines.push({
            orNumber: lineOr,
            itemDescription: entry.name,
            fundAllocation: entry.fund,
            paymentType,
            amountCentavos: entry.amount,
            balanceCentavos: entry.balance,
          });
        }
        if (!isPackage) {
          await kenRule('conflict', () =>
            applyPaymentToStudentCollectibles(tx, {
              organizationId: org.id,
              academicYear: remit.academicYear,
              term: remit.term,
              studentId: student.studentId,
              category: String(remit.category || ''),
              itemDescription,
              amountCents,
            })
          );
        }
        await tx.systemLog.create({
          data: {
            organizationId: org.id,
            user: officerName,
            action: 'VERIFY_REMITTANCE',
            details: `Verified ${remit.submissionId}; OR ${orNumber}; ₱${amount.toFixed(2)}; ${student.studentId}.`,
          },
        });
        await enqueuePaymentReceipt(tx, {
          organizationId: org.id,
          orNumber,
          officerName,
          officerEmail: String(officer.email || ''),
          source: 'APPROVED_REMITTANCE',
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (err) {
    mapTxError(err, orNumber);
  }

  revalidateDepartment(org.subdomain, ['remittances', 'collections', 'clearance', 'reports', 'summary', 'realign', 'collectibles']);
  scheduleDigitalReceiptDispatch(org.id, `payment:${orNumber}`);
  return { orNumber, lines };
}

/** Mirrors invalidateOnlineRemittance (status Rejected + the rejection notice email). */
export async function invalidateRemittance(org: Organization, officer: Officer, remittanceId: string) {
  const officerName = officerNameOf(officer);
  try {
    await prisma.$transaction(
      async (tx) => {
        const remit = await tx.onlineRemittance.findFirst({ where: { id: remittanceId, organizationId: org.id } });
        // Ken answers both cases with one message; the API keeps 404 vs 409 apart.
        if (!remit) throw new DomainError('Online submission was not found in this organization.', 'not_found');
        if (!isPending(remit.status)) throw new DomainError('Only pending remittances can be rejected.', 'conflict');
        const update = await tx.onlineRemittance.updateMany({
          where: { id: remit.id, organizationId: org.id, status: remit.status },
          data: { status: 'Rejected', reviewedBy: officerName, reviewNotes: 'Rejected by an authorized verification officer.' },
        });
        if (update.count !== 1) throw new DomainError('This submission was already reviewed.', 'conflict');
        await tx.systemLog.create({
          data: {
            organizationId: org.id,
            user: officerName,
            action: 'INVALIDATE_REMITTANCE',
            details: `Rejected submitted payment proof ${remit.submissionId} / ${remit.referenceNumber}.`,
          },
        });
        // Rejection is a decision notice, NOT a payment receipt. No OR is invented.
        const matched = remit.studentId
          ? await tx.student.findFirst({
              where: { organizationId: org.id, OR: [{ id: remit.studentId }, { studentId: remit.studentId }] },
              select: { email: true, fullName: true },
            })
          : null;
        await enqueueAccountingNotice(tx, {
          organizationId: org.id,
          eventKey: `remittance-rejected:${remit.id}`,
          documentType: 'Remittance Rejection Notice',
          referenceNo: remit.submissionId,
          academicYear: remit.academicYear,
          term: remit.term,
          amount: Number(remit.amountPaid || 0),
          officerName,
          officerEmail: String(officer.email || ''),
          participantName: matched?.fullName || remit.studentName,
          participantEmail: matched?.email,
          details: [
            { label: 'Decision', value: 'Rejected — no official payment receipt issued' },
            { label: 'Channel reference', value: remit.referenceNumber },
          ],
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (err) {
    mapTxError(err);
  }
  revalidateDepartment(org.subdomain, ['remittances']);
  scheduleDigitalReceiptDispatch(org.id, `remittance-rejected:${remittanceId}`);
}
