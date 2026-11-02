import { handler, preflight, readJson, requireFinancialWriteCentavos, requireString, ApiFailure } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { postAuthorizedPayment } from '@/lib/financial/authorized-payment';
import { prisma } from '@/lib/prisma';
import { PACKAGE_FEE_PREFIX, PACKAGE_NAME, PACKAGE_FUND_LABEL } from '@/lib/mobile/fee-items';
import { manilaDateInput } from '@/lib/clear-timezone';
import { toCents } from '@/app/department/[department]/(protected)/realign/ledger';

type Ctx = { params: Promise<{ org: string }> };
type PaymentBody = { studentId: string; feeId: string; amountCentavos: number };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Native officer collection: server allocates official receipts; never trust client fee amounts or OR numbers. */
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const { org, officer } = await requireMobileOfficer(req, slug, 'tab-payment');
  const key = requireString(req.headers.get('Idempotency-Key'), 'Idempotency-Key', 128);
  if (!UUID.test(key)) throw new ApiFailure(400, 'invalid', 'A UUID idempotency key is required.');
  const body = await readJson<PaymentBody>(req);
  const studentId = requireString(body.studentId, 'Student', 100);
  const feeId = requireString(body.feeId, 'Fee', 200);
  const cents = requireFinancialWriteCentavos(body.amountCentavos, 'Payment');
  const student = await prisma.student.findFirst({
    where: { organizationId: org.id, id: studentId },
    select: { id: true, fullName: true, studentId: true },
  });
  if (!student) throw new ApiFailure(422, 'invalid_student', 'Student does not belong to this tenant.');
  const packageId = feeId.startsWith(PACKAGE_FEE_PREFIX) ? feeId.slice(PACKAGE_FEE_PREFIX.length) : null;
  const setup = await prisma.collectionSetup.findFirst({
    where: { organizationId: org.id, academicYear: org.activeAy, term: org.activeTerm, id: packageId || feeId },
  });
  if (!setup) throw new ApiFailure(400, 'invalid', 'Fee is not configured for the active term.');
  const packageItems = packageId ? await prisma.collectionSetup.findMany({
    where: { organizationId: org.id, academicYear: org.activeAy, term: org.activeTerm, category: setup.category, isPackage: true },
  }) : [];
  if (packageId && (!setup.isPackage || packageItems.length < 2)) {
    throw new ApiFailure(400, 'invalid', 'This package is not available.');
  }
  // A dropped response must replay the ORIGINAL accounting date, even after
  // Manila midnight. Derive it from a tenant-scoped persisted receipt, never
  // from a client-provided date (which could silently backdate a payment).
  const prior = await prisma.paymentRequest.findUnique({
    where: { organizationId_requestId: { organizationId: org.id, requestId: key } },
    select: { orNumber: true },
  });
  const priorReceipt = prior ? await prisma.collection.findFirst({
    where: { organizationId: org.id, orNumber: prior.orNumber }, select: { date: true },
  }) : null;
  const accountingDate = priorReceipt ? priorReceipt.date.toISOString().slice(0, 10) : manilaDateInput();
  const standardRate = packageId ? packageItems.reduce((sum, item) => sum + toCents(item.amount), 0) / 100 : Number(setup.amount);
  let result;
  try {
    result = await postAuthorizedPayment(org.subdomain, {
    requestId: key,
    date: accountingDate,
    studentId: student.id, studentName: student.fullName,
    category: setup.category,
    itemDescription: packageId ? PACKAGE_NAME : setup.name,
    paymentType: 'Partial Payment',
    standardRate,
    amountPaid: cents / 100,
    fundAllocation: packageId ? PACKAGE_FUND_LABEL : setup.targetFund,
    ay: org.activeAy, term: org.activeTerm,
  }, officer);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Payment request ID was reused with different payment details.') {
        throw new ApiFailure(409, 'idempotency_conflict', 'This retry key belongs to a different payment. Review the original receipt before starting a new collection.');
      }
      if (/^Payment exceeds (?:the remaining due|the remaining package balance|the outstanding fine) of ₱[\d,.]+\.\d{2}\.$/.test(error.message)) {
        throw new ApiFailure(422, 'overpayment', error.message);
      }
      if (/This academic term is closed|academic period .*closed/i.test(error.message)) {
        throw new ApiFailure(409, 'period_closed', 'The academic period is closed. No payment was recorded.');
      }
      if (error.message.startsWith('This payment was posted but its receipt is now voided or invalid.')) {
        throw new ApiFailure(409, 'receipt_invalid', 'The earlier receipt is no longer valid. Contact the auditor before retrying.');
      }
    }
    throw error;
  }
  return { success: true, reference: result.orNumber, orNumber: result.orNumber, balanceDue: result.balanceDue,
    paymentEntries: result.paymentEntries, paymentType: result.paymentType, title: student.fullName };
});
export const OPTIONS = preflight;
