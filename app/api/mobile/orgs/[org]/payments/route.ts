// POST /api/mobile/orgs/:org/payments { studentId, feeId, amountCentavos, orNumber } -> LedgerEntry
// Records an in-person payment against a fee item (same rules as the web Collections module).

import { prisma } from '@/lib/prisma';
import { ApiFailure, handler, json, preflight, readJson, requireCentavos, requireString } from '@/lib/mobile/http';
import { collectionEntry } from '@/lib/mobile/data';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { toPesos } from '@/lib/mobile/serialize';
import { recordPaymentFor } from '@/lib/collections';

type Ctx = { params: Promise<{ org: string }> };

export const POST = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const { officer, org } = await requireMobileOfficer(req, slug, 'tab-payment');

  const body = await readJson<{ studentId: string; feeId: string; amountCentavos: number; orNumber: string }>(req);
  const studentId = requireString(body.studentId, 'Student', 64);
  const feeId = requireString(body.feeId, 'Fee item', 64);
  const amountCentavos = requireCentavos(body.amountCentavos, 'Amount');
  const orNumber = requireString(body.orNumber, 'OR number', 40).toUpperCase();

  const [student, fee] = await Promise.all([
    prisma.student.findFirst({ where: { id: studentId, organizationId: org.id } }),
    prisma.collectionSetup.findFirst({
      where: { id: feeId, organizationId: org.id, academicYear: org.activeAy, term: org.activeTerm },
    }),
  ]);
  if (!student) throw new ApiFailure(422, 'invalid_student', 'Choose a student from this department’s roster.');
  if (!fee) throw new ApiFailure(400, 'invalid', 'Choose a fee item for the current term.');

  const result = await recordPaymentFor(org, officer.fullName, {
    orNumber,
    date: new Date().toISOString(),
    studentId: student.id,
    studentName: student.fullName,
    studentEmail: student.email || undefined,
    category: fee.category,
    itemDescription: fee.name,
    paymentType: 'Partial Payment',
    standardRate: fee.amount,
    amountPaid: toPesos(amountCentavos),
    fundAllocation: fee.targetFund,
    ay: org.activeAy,
    term: org.activeTerm,
  });

  const row = await prisma.collection.findUniqueOrThrow({ where: { id: result.collectionId } });
  return json(req, collectionEntry(row), 201);
});

export const OPTIONS = preflight;
