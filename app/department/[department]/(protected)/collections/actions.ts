"use server";
import { postAuthorizedPayment } from "@/lib/financial/authorized-payment";
import { moneyNumber } from "@/lib/money-precision";
import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import { summarizeValidCollectionCredits } from "@/lib/collection-payment-preview.mjs";

/**
 * A tenant-scoped, authorized balance preview for ONE student.
 * The actual payment constraints are always recalculated transactionally
 * inside recordPayment, preventing stale previews from creating overpayments.
 */
export async function getStudentPaymentCredits(
  department: string,
  data: { studentId: string; ay: string; term: string }
) {
  const slug = decodeURIComponent(department).trim().toLowerCase();
  await requireTabAccess("tab-payment", slug);
  const org = await prisma.organization.findUnique({
    where: { subdomain: slug }, select: { id: true },
  });
  if (!org) throw new Error("Department not found.");
  const studentId = String(data.studentId || "").trim();
  const ay = String(data.ay || "").trim();
  const term = String(data.term || "").trim();
  if (!studentId || studentId.length > 100 || !ay || !term || ay.length > 80 || term.length > 80) {
    throw new Error("Valid student and academic period are required.");
  }
  const student = await prisma.student.findFirst({
    where: { organizationId: org.id, studentId: { equals: studentId, mode: "insensitive" } },
    select: { id: true },
  });
  if (!student) throw new Error("Student was not found in this department.");
  const receipts = await prisma.collection.findMany({
    where: { organizationId: org.id, academicYear: ay, term, studentId: student.id },
    select: { itemDescription: true, amountPaid: true, status: true, paymentType: true },
  });
  return { credits: summarizeValidCollectionCredits(receipts.map(r => ({ ...r, amountPaid: moneyNumber(r.amountPaid) }))) };
}

export async function recordPayment(department: string, data: {
  requestId: string; orNumber?: string; date: string; studentId: string; studentName: string;
  studentEmail?: string; category: string; itemDescription: string;
  paymentType: string; standardRate: number; amountPaid: number;
  fundAllocation: string; ay: string; term: string; penaltyId?: string;
}) {
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();
  const officer = await requireTabAccess("tab-payment", cleanDepartment);
  return postAuthorizedPayment(cleanDepartment, data, officer);
}

/**
 * Trusted shared financial posting core. Caller MUST authorize the officer and
 * tenant before invoking this function. Never expose it as a server action.
 */
