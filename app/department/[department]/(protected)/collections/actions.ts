"use server";
import { postAuthorizedPayment } from "@/lib/financial/authorized-payment";
import { moneyNumber } from "@/lib/money-precision";
import { createHash } from "node:crypto";
import { parseClearAccountingDate } from '@/lib/clear-timezone';

import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import { enqueuePaymentReceipt, scheduleDigitalReceiptDispatch } from "@/lib/digital-receipts";
import { revalidatePath } from "next/cache";
import { withFinancialTransaction } from "@/lib/financial-transaction";
import { allocateOfficialReceiptNumber, lockReceiptNumber } from "@/lib/receipt-number";
import { summarizeValidCollectionCredits } from "@/lib/collection-payment-preview.mjs";
import { getPeriodLedger, toCents } from "../realign/ledger";
import { applyPaymentToStudentCollectibles } from "../collectibles/due-link";
import { PENALTY_FUND_NAME } from "@/lib/penalty-fund";
import { ensurePenaltyFund } from "@/lib/penalty-fund.server";
import { assertAcademicPeriod } from "@/lib/academic-period-guard";

const PACKAGE_NAME = "Departmental Fee Package (All Items)";

function money(value: unknown, label: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > Number.MAX_SAFE_INTEGER / 100 ||
      Math.abs(n * 100 - Math.round(n * 100)) > .000001) {
    throw new Error(`${label} must be a positive amount with at most two decimal places.`);
  }
  return Math.round(n * 100) / 100;
}

function dateOnly(value: string): Date {
  try { return parseClearAccountingDate(value); }
  catch { throw new Error("Invalid payment date."); }
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c] || c));
}

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
