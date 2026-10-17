// /app/department/[department]/(protected)/penalties/actions.ts

"use server";

import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

// =========================================================================
// HELPER FUNCTIONS (Internal to this module)
// =========================================================================

function money(val: any, fieldName: string): number {
  const parsed = parseFloat(val);
  if (isNaN(parsed)) throw new Error(`Invalid monetary value for ${fieldName}`);
  return parsed;
}

function parseDate(val: any, fieldName: string): Date {
  const date = new Date(val);
  if (isNaN(date.getTime())) throw new Error(`Invalid date format for ${fieldName}`);
  return date;
}

function generateReference(prefix: string): string {
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  const timestamp = Date.now().toString().slice(-4);
  return `${prefix}-${randomStr}-${timestamp}`;
}

// =========================================================================
// PENALTIES ACTIONS
// =========================================================================

export async function recordPenalty(
  department: string,
  data: {
    date: string;
    studentId: string;
    studentName?: string;
    activity: string;
    hoursLate: number;
    ratePerHour: number;
    fineAmount: number;
    ay: string;
    term: string;
  }
) {
  // 1. Verify Permission
  const customUser = await requireTabAccess("tab-penalties", department);
  const officerName = customUser.fullName || customUser.email || "System Administrator";

  // 2. Resolve Organization ID
  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() }
  });
  if (!organization) throw new Error(`Organization subdomain "${department}" not found.`);
  const orgId = organization.id;

  // 3. Validate Inputs
  const date = parseDate(data.date, "penalty date");
  const hoursLate = Number(data.hoursLate);
  const ratePerHour = money(data.ratePerHour, "Rate per hour");
  const fineAmount = money(data.fineAmount, "Fine amount");

  if (!Number.isFinite(hoursLate) || hoursLate < 0) {
    throw new Error("Hours late must be a valid non-negative number.");
  }
  if (fineAmount <= 0) {
    throw new Error("Fine amount must be greater than zero.");
  }

  const penaltyId = generateReference("PEN");

  // 4. Create Database Record
  await prisma.penalty.create({
    data: {
      organizationId: orgId,
      penaltyId,
      academicYear: data.ay,
      term: data.term,
      date,
      studentId: String(data.studentId || "").trim() || null,
      studentName: String(data.studentName || "").trim() || "Unknown",
      activity: String(data.activity || "").trim(),
      hoursLate,
      ratePerHour,
      fineAmount,
      status: "Unsettled",
      encodedBy: officerName,
    },
  });

  // 5. Audit Log
  try {
    await prisma.systemLog.create({
      data: {
        organizationId: orgId,
        user: officerName,
        action: "RECORD_PENALTY",
        details: `Assessed ₱${fineAmount.toFixed(2)} fine (${hoursLate} hrs) to ${data.studentName || "Unknown"} for ${data.activity}.`,
      }
    });
  } catch (error) {
    console.warn("System logging failed:", error);
  }

  // 6. Revalidate Cache
  revalidatePath(`/department/${department}/penalties`);
  revalidatePath(`/department/${department}`);
}

export async function settlePenaltyCommunityService(
  department: string,
  data: {
    penaltyId: string;
    hoursRendered: number;
    ay: string;
    term: string;
  }
) {
  // 1. Verify Permission
  const customUser = await requireTabAccess("tab-penalties", department);
  const officerName = customUser.fullName || customUser.email || "System Administrator";

  // 2. Resolve Organization ID
  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() }
  });
  if (!organization) throw new Error(`Organization subdomain "${department}" not found.`);
  const orgId = organization.id;

  // 3. Validate Inputs
  const hoursRendered = Number(data.hoursRendered);
  if (!Number.isFinite(hoursRendered) || hoursRendered <= 0) {
    throw new Error("Hours rendered must be greater than zero.");
  }

  // 4. Fetch Penalty Record
  const targetPen = await prisma.penalty.findFirst({
    where: { penaltyId: data.penaltyId, organizationId: orgId },
  });

  if (!targetPen) throw new Error("Penalty record not found.");

  const existingFine = Math.max(0, Number(targetPen.fineAmount) || 0);
  if (existingFine <= 0) {
    throw new Error("This penalty has already been fully settled.");
  }

  // 5. Calculate Deductions
  const rate = Math.max(0, Number(targetPen.ratePerHour) || 50);
  const deductionPesos = Math.round(hoursRendered * rate * 100) / 100;
  const remainingFine = Math.max(0, Math.round((existingFine - deductionPesos) * 100) / 100);

  const newStatus = remainingFine === 0
    ? `Settled (Community Service - ${hoursRendered} hrs rendered)`
    : `Partially Served (${hoursRendered} hrs served, ₱${deductionPesos.toFixed(2)} deducted)`;

  // 6. Update Database Record
  await prisma.penalty.update({
    where: { id: targetPen.id },
    data: { fineAmount: remainingFine, status: newStatus },
  });

  // 7. Audit Log
  try {
    await prisma.systemLog.create({
      data: {
        organizationId: orgId,
        user: officerName,
        action: "SETTLE_PENALTY_SERVICE",
        details: `Applied ${hoursRendered} hrs community service to penalty [${data.penaltyId}]. Status: ${newStatus}`,
      }
    });
  } catch (error) {
    console.warn("System logging failed:", error);
  }

  // 8. Revalidate Cache
  revalidatePath(`/department/${department}/penalties`);
  revalidatePath(`/department/${department}`);
}

// =========================================================================
// NEW: CASH PAYMENT SETTLEMENT HANDLER
// =========================================================================
export async function settlePenaltyCash(
  department: string,
  data: {
    penaltyId: string;
    amountPaid: number;
    ay: string;
    term: string;
  }
) {
  const customUser = await requireTabAccess("tab-payment", department);
  const officerName = customUser.fullName || customUser.email || "System Administrator";

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() }
  });
  if (!organization) throw new Error(`Organization subdomain "${department}" not found.`);
  const orgId = organization.id;

  const amountPaid = money(data.amountPaid, "Amount Paid");
  if (amountPaid <= 0) throw new Error("Payment amount must be greater than zero.");

  const targetPen = await prisma.penalty.findFirst({
    where: { penaltyId: data.penaltyId, organizationId: orgId },
  });

  if (!targetPen) throw new Error("Penalty record not found.");

  const existingFine = Math.max(0, Number(targetPen.fineAmount) || 0);
  if (existingFine <= 0) {
    throw new Error("This penalty has already been fully settled.");
  }

  const remainingFine = Math.max(0, Math.round((existingFine - amountPaid) * 100) / 100);

  const newStatus = remainingFine === 0
    ? `Settled (Cash Payment - ₱${amountPaid.toFixed(2)})`
    : `Partially Paid (₱${amountPaid.toFixed(2)} paid, ₱${remainingFine.toFixed(2)} remaining)`;

  await prisma.penalty.update({
    where: { id: targetPen.id },
    data: { fineAmount: remainingFine, status: newStatus },
  });

  try {
    await prisma.systemLog.create({
      data: {
        organizationId: orgId,
        user: officerName,
        action: "SETTLE_PENALTY_CASH",
        details: `Applied ₱${amountPaid.toFixed(2)} cash payment to penalty [${data.penaltyId}]. Status: ${newStatus}`,
      }
    });
  } catch (error) {
    console.warn("System logging failed:", error);
  }

  revalidatePath(`/department/${department}/penalties`);
  revalidatePath(`/department/${department}/collections`);
  revalidatePath(`/department/${department}`);
}

export async function deletePenalty(department: string, penaltyId: string) {
  // 1. Verify Permission (Notice this requires tab-void)
  await requireTabAccess("tab-void", department);

  // 2. Resolve Organization ID
  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() }
  });
  if (!organization) throw new Error(`Organization subdomain "${department}" not found.`);
  const orgId = organization.id;

  // 3. Delete Record
  const result = await prisma.penalty.deleteMany({
    where: { id: penaltyId, organizationId: orgId },
  });

  if (result.count === 0) {
    throw new Error("Penalty record not found.");
  }

  // 4. Revalidate Cache
  revalidatePath(`/department/${department}/penalties`);

  return {
    success: true,
    message: "Penalty record deleted successfully.",
  };
}