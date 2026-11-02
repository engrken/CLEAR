import { handler, preflight, readJson, requireFinancialWriteCentavos, requireString, ApiFailure } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { postAuthorizedPayment } from '@/lib/financial/authorized-payment';
import { prisma } from '@/lib/prisma';
import { PACKAGE_FEE_PREFIX, PACKAGE_NAME } from '@/lib/mobile/fee-items';

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
  if (packageId) {
    const count = await prisma.collectionSetup.count({
      where: { organizationId: org.id, academicYear: org.activeAy, term: org.activeTerm, category: setup.category, isPackage: true },
    });
    if (!setup.isPackage || count < 2) throw new ApiFailure(400, 'invalid', 'This package is not available.');
  }
  const result = await postAuthorizedPayment(org.subdomain, {
    requestId: key,
    date: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()),
    studentId: student.id, studentName: student.fullName,
    category: setup.category,
    itemDescription: packageId ? PACKAGE_NAME : setup.name,
    paymentType: 'Partial Payment',
    standardRate: Number(setup.amount),
    amountPaid: cents / 100,
    fundAllocation: setup.targetFund,
    ay: org.activeAy, term: org.activeTerm,
  }, officer);
  return { success: true, reference: result.orNumber, orNumber: result.orNumber, balanceDue: result.balanceDue,
    paymentEntries: result.paymentEntries, paymentType: result.paymentType, title: student.fullName };
});
export const OPTIONS = preflight;
