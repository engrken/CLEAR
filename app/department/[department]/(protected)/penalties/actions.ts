// app/department/[department]/(protected)/penalties/actions.ts
"use server";

import { Prisma } from "@prisma/client";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { getPeriodLedger } from "../realign/ledger";
import { ensurePenaltyFund } from "@/lib/penalty-fund.server";
import { assertAcademicPeriod } from "@/lib/academic-period-guard";

const norm = (value: unknown): string => String(value ?? "").trim();
const isVoided = (value: unknown): boolean => /VOID|CANCEL/i.test(norm(value));
const isSettled = (value: unknown): boolean => /^SETTLED/i.test(norm(value));

function cleanDepartment(value: string): string {
  let department: string;
  try { department = decodeURIComponent(norm(value)).toLowerCase(); }
  catch { throw new Error("Invalid department identifier."); }
  if (!department) throw new Error("A department is required.");
  return department;
}

function exactCents(value: unknown, label: string, allowZero = false): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || (!allowZero && amount === 0) ||
      amount > Number.MAX_SAFE_INTEGER / 100 ||
      Math.abs(amount * 100 - Math.round(amount * 100)) > 0.00001) {
    throw new Error(`${label} must be a ${allowZero ? 'nonnegative' : 'positive'} peso amount with at most two decimals.`);
  }
  return Math.round(amount * 100);
}

function parseDateOnly(value: string): Date {
  const input = norm(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) throw new Error("Use a valid YYYY-MM-DD penalty date.");
  const date = new Date(`${input}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) {
    throw new Error("Penalty date is invalid.");
  }
  return date;
}

function positiveMinutes(hours: unknown, label: string): number {
  const value = Number(hours);
  if (!Number.isFinite(value) || value <= 0 || value > 10000) {
    throw new Error(`${label} must be greater than zero and no more than 10,000 hours.`);
  }
  const minutes = Math.round(value * 60);
  if (minutes < 1 || Math.abs(value * 60 - minutes) > 0.0001) {
    throw new Error(`${label} must be specified in whole minutes.`);
  }
  return minutes;
}

async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 20000,
      });
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("A concurrent update occurred. Try again.");
}

function refreshPenaltyViews(department: string) {
  const root = `/department/${department}`;
  for (const path of ["", "/penalties", "/clearance", "/collections", "/reports", "/summary", "/logs", "/void"]) {
    revalidatePath(root + path);
  }
}

async function getOrganization(department: string) {
  const org = await prisma.organization.findUnique({
    where: { subdomain: department },
    select: { id: true },
  });
  if (!org) throw new Error("Department organization was not found.");
  return org;
}

async function requireOpenPeriod(
  tx: Prisma.TransactionClient,
  organizationId: string,
  ay: string,
  term: string,
) {
  await assertAcademicPeriod(tx, organizationId, ay, term);
  const ledger = await getPeriodLedger(tx, organizationId, ay, term);
  if (ledger.activeRollover) {
    throw new Error("This term was already carried over. Reverse the rollover before changing penalty records.");
  }
}

export async function recordPenalty(department: string, data: {
  date: string;
  studentId: string;
  studentName?: string;
  activity: string;
  hoursLate: number;
  ratePerHour: number;
  fineAmount: number;
  penaltyType?: "SERVICE_ELIGIBLE" | "LATE_FEE";
  fixedAmount?: number;
  ay: string;
  term: string;
}) {
  const dept = cleanDepartment(department);
  const officer = await requireTabAccess("tab-penalties", dept);
  const officerName = norm((officer as any)?.fullName || officer?.name || officer?.email) || "Authorized Officer";
  const org = await getOrganization(dept);
  const ay = norm(data.ay);
  const term = norm(data.term);
  const studentId = norm(data.studentId);
  const activity = norm(data.activity);
  if (!ay || !term || !studentId || !activity) {
    throw new Error("Student, activity, academic year, and term are required.");
  }
  if (activity.length > 240) throw new Error("The activity description is too long.");
  const date = parseDateOnly(data.date);
  const penaltyType = data.penaltyType || "SERVICE_ELIGIBLE";
  if (penaltyType !== "SERVICE_ELIGIBLE" && penaltyType !== "LATE_FEE") {
    throw new Error("Invalid penalty type.");
  }
  // Late Fees are flat cash-only assessments. They have NO fictitious hours or hourly rate.
  const durationMinutes = penaltyType === "LATE_FEE" ? 0 : positiveMinutes(data.hoursLate, "Lateness duration");
  const rateCents = penaltyType === "LATE_FEE" ? 0 : exactCents(data.ratePerHour, "Hourly rate");
  if (rateCents > 1_000_000) throw new Error("The hourly rate exceeds the permitted limit.");
  const assessedCents = penaltyType === "LATE_FEE"
    ? exactCents(data.fixedAmount, "Late fee amount")
    : Math.round(durationMinutes * rateCents / 60);
  if (assessedCents <= 0) throw new Error("Calculated fine must be greater than zero.");
  // The browser's preview is informational; the server always calculates the assessment.
  const clientFineCents = exactCents(data.fineAmount, "Calculated fine");
  if (Math.abs(assessedCents - clientFineCents) > 1) {
    throw new Error("The fine does not match the duration and rate. Refresh and try again.");
  }

  const result = await serializable(async (tx) => {
    await requireOpenPeriod(tx, org.id, ay, term);
    // Every tenant that uses the Penalties module receives its own period-scoped pool.
    // Assessment itself is NOT cash income.
    await ensurePenaltyFund(tx, org.id, ay, term);
    const student = await tx.student.findFirst({
      where: { organizationId: org.id, studentId: { equals: studentId, mode: "insensitive" } },
      select: { studentId: true, fullName: true },
    });
    if (!student) throw new Error("The selected student is not in this department's roster.");
    // Prevent accidental second submissions of the same infraction on the same day.
    const start = new Date(`${norm(data.date)}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const candidates = await tx.penalty.findMany({ where: {
      organizationId: org.id, academicYear: ay, term,
      studentId: student.studentId,
      date: { gte: start, lt: end },
    }, select: { activity: true, status: true } });
    if (candidates.some(p => !isVoided(p.status) && norm(p.activity).toLowerCase() === activity.toLowerCase())) {
      throw new Error("A penalty for this student, activity, and date already exists. Check Penalty Logs.");
    }

    const record = await tx.penalty.create({ data: {
      organizationId: org.id,
      penaltyId: `PEN-${crypto.randomUUID().toUpperCase()}`,
      academicYear: ay,
      term,
      date,
      studentId: student.studentId,
      studentName: student.fullName,
      activity,
      hoursLate: durationMinutes / 60,
      ratePerHour: rateCents / 100,
      penaltyType,
      assessedAmount: assessedCents / 100,
      fineAmount: assessedCents / 100,
      status: "Unsettled",
      encodedBy: officerName,
    } });
    await tx.systemLog.create({ data: {
      organizationId: org.id,
      user: officerName,
      action: "RECORD_PENALTY",
      details: `Penalty ${record.penaltyId}: ${student.studentId} (${student.fullName}); type ${penaltyType}; ${activity}; ${durationMinutes} minute(s) @ ₱${(rateCents / 100).toFixed(2)}/hr; assessed ₱${(assessedCents / 100).toFixed(2)}; ${ay} ${term}.`,
    } });
    return { penaltyId: record.penaltyId, fineAmount: record.fineAmount };
  });
  refreshPenaltyViews(dept);
  return { success: true, ...result };
}

export async function settlePenaltyCommunityService(department: string, data: {
  penaltyId: string;
  hoursRendered: number;
  ay: string;
  term: string;
}) {
  const dept = cleanDepartment(department);
  const officer = await requireTabAccess("tab-penalties", dept);
  const officerName = norm((officer as any)?.fullName || officer?.name || officer?.email) || "Authorized Officer";
  const org = await getOrganization(dept);
  const penaltyId = norm(data.penaltyId);
  const ay = norm(data.ay);
  const term = norm(data.term);
  const serviceMinutes = positiveMinutes(data.hoursRendered, "Service duration");
  if (!penaltyId || !ay || !term) throw new Error("Penalty reference and academic term are required.");

  const result = await serializable(async (tx) => {
    const penalty = await tx.penalty.findFirst({
      where: { organizationId: org.id, penaltyId, academicYear: ay, term },
    });
    if (!penalty) throw new Error("Penalty not found in this department and term.");
    if (isVoided(penalty.status)) throw new Error("Cannot apply service to a voided penalty.");
    // This MUST be checked server-side. A forged request must never convert a Late Fee.
    if (penalty.penaltyType === "LATE_FEE") {
      throw new Error("Late Fees are cash-only. Community-service conversion is not permitted.");
    }
    if (isSettled(penalty.status)) throw new Error("This penalty is already settled.");
    const remainingCents = exactCents(penalty.fineAmount, "Outstanding penalty", true);
    if (remainingCents <= 0) throw new Error("This penalty has no remaining fine.");
    const rateCents = exactCents(penalty.ratePerHour, "Penalty rate");
    if (rateCents <= 0) throw new Error("Penalty rate must be greater than zero.");
    const maxMinutes = Math.ceil(remainingCents * 60 / rateCents);
    if (serviceMinutes > maxMinutes) {
      throw new Error(`Service hours exceed the outstanding penalty equivalent (maximum approximately ${maxMinutes} minutes).`);
    }
    const deductionCents = Math.min(remainingCents, Math.round(serviceMinutes * rateCents / 60));
    if (deductionCents <= 0) throw new Error("Service duration is too short to apply a monetary credit.");
    await requireOpenPeriod(tx, org.id, ay, term);

    const newCents = remainingCents - deductionCents;
    const newStatus = newCents === 0 ? "Settled (Community Service)" : "Partially Served";
    // hoursLate is the original assessed duration; fineAmount is the live balance.
    await tx.penalty.update({ where: { id: penalty.id }, data: {
      fineAmount: newCents / 100,
      status: newStatus,
    } });
    await tx.penaltySettlementEvent.create({ data: {
      organizationId: org.id, penaltyRecordId: penalty.id,
      method: "COMMUNITY_SERVICE", amount: deductionCents / 100,
      minutesRendered: serviceMinutes,
      accountingAY: ay, accountingTerm: term,
      balanceBefore: remainingCents / 100, balanceAfter: newCents / 100,
      recordedBy: officerName,
      note: "Verified community-service credit; not cash income",
    } });
    await tx.systemLog.create({ data: {
      organizationId: org.id,
      user: officerName,
      action: "SETTLE_PENALTY_SERVICE",
      details: `${penaltyId}: ${serviceMinutes} minutes rendered; before ₱${(remainingCents / 100).toFixed(2)}; credit ₱${(deductionCents / 100).toFixed(2)}; after ₱${(newCents / 100).toFixed(2)}; ${ay} ${term}.`,
    } });
    return { success: true, deducted: deductionCents / 100, balanceDue: newCents / 100, status: newStatus };
  });
  refreshPenaltyViews(dept);
  return result;
}

/**
 * Deprecated on purpose: this action used to mark a fine as paid WITHOUT
 * creating a Collection / Official Receipt, corrupting the financial ledger.
 * The Collections module's recordPayment() already supports penaltyId and
 * performs the receipt posting and penalty adjustment in one transaction.
 */
export async function settlePenaltyCash(_department: string, _data: {
  penaltyId: string;
  amountPaid: number;
  ay: string;
  term: string;
}) {
  throw new Error("Cash penalty settlement must be recorded in Collections with its penaltyId and an official receipt. Open Penalty Logs and select 'Pay in Cash'.");
}

/**
 * ADMIN-ONLY CORRECTION FOR LEGACY 'Settled (Cash Payment)' RECORDS.
 * Does not post cash, fabricate a receipt, or presume nonpayment. An admin
 * must verify the actual receipt history and affirm the correct outstanding
 * amount before a new collection can be accepted.
 */
export async function reconcileLegacyCashSettlement(department: string, data: {
  penaltyId: string; ay: string; term: string; restoredBalance: number; reason: string;
}) {
  const dept = cleanDepartment(department);
  const { requireOrgAdmin } = await import("@/lib/permissions");
  const actor = await requireOrgAdmin(dept);
  const actorName = norm((actor as any)?.fullName || actor?.name || actor?.email) || "Administrator";
  const org = await getOrganization(dept);
  const reference = norm(data.penaltyId);
  const ay = norm(data.ay);
  const term = norm(data.term);
  const reason = norm(data.reason);
  if (!reference || !ay || !term) throw new Error("Penalty reference and term are required.");
  if (reason.length < 20 || reason.length > 500) throw new Error("Supply an evidence-based reconciliation reason (20–500 characters).");
  const amount = exactCents(data.restoredBalance, "Verified outstanding amount");

  const result = await serializable(async tx => {
    await requireOpenPeriod(tx, org.id, ay, term);
    const pen = await tx.penalty.findFirst({ where: {
      organizationId: org.id, penaltyId: reference, academicYear: ay, term,
    } });
    if (!pen) throw new Error("Penalty not found in the selected department/term.");
    if (!/^SETTLED\s*\(CASH PAYMENT/i.test(pen.status || "") || toCentsSafe(pen.fineAmount) !== 0) {
      throw new Error("Only a zero-balance legacy cash-settled penalty may be reconciled here.");
    }
    const maxCents = pen.assessedAmount != null
      ? toCentsSafe(pen.assessedAmount)
      : Math.round(Number(pen.hoursLate) * toCentsSafe(pen.ratePerHour));
    if (!Number.isSafeInteger(maxCents) || maxCents <= 0 || amount > maxCents) {
      throw new Error("Verified outstanding amount exceeds the original assessed fine.");
    }
    // Any real receipt or service credit needs full manual accounting; do not
    // reopen through this restricted shortcut in those circumstances.
    const student = pen.studentId ? await tx.student.findFirst({
      where: { organizationId: org.id, studentId: { equals: pen.studentId, mode: "insensitive" } },
      select: { id: true },
    }) : null;
    if (!student) throw new Error("Student identity could not be verified. Use the formal audit process.");
    const receipts = await tx.collection.findMany({ where: {
      organizationId: org.id, academicYear: ay, term, studentId: student.id,
      OR: [
        { itemDescription: { equals: `Penalty Fine: ${pen.activity}`, mode: "insensitive" } },
        { itemDescription: { contains: pen.penaltyId, mode: "insensitive" } },
      ],
    }, select: { id: true, status: true, paymentType: true } });
    if (receipts.some(r => !isVoided(r.status) && !isVoided(r.paymentType))) {
      throw new Error("A valid cash receipt already exists. Reconcile the receipt before reopening the penalty.");
    }
    const serviceCredit = await tx.systemLog.findFirst({ where: {
      organizationId: org.id, action: "SETTLE_PENALTY_SERVICE", details: { contains: pen.penaltyId },
    }, select: { id: true } });
    if (serviceCredit) throw new Error("Community-service credits exist. Perform a full audit reconciliation instead.");
    const updated = await tx.penalty.updateMany({ where: {
      id: pen.id, organizationId: org.id, status: pen.status, fineAmount: 0,
    }, data: { fineAmount: amount / 100, status: "Unsettled (Cash Reconciliation)" } });
    if (updated.count !== 1) throw new Error("Penalty changed during reconciliation.");
    await tx.systemLog.create({ data: {
      organizationId: org.id, user: actorName, action: "RECONCILE_LEGACY_PENALTY_CASH",
      details: `Penalty ${reference}; ${ay} ${term}; original status ${pen.status}; restored outstanding ₱${(amount / 100).toFixed(2)}; original assessment ₱${(maxCents / 100).toFixed(2)}. Administrator justification: ${reason}`,
    } });
    return { success: true, penaltyId: reference, outstanding: amount / 100 };
  });
  refreshPenaltyViews(dept);
  return result;
}

function toCentsSafe(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > Number.MAX_SAFE_INTEGER / 100) {
    throw new Error("Invalid penalty monetary value.");
  }
  return Math.round(number * 100);
}

/** Retains the old exported function name for existing clients; performs an audited SOFT VOID. */
export async function deletePenalty(department: string, recordId: string, reason?: string) {
  const dept = cleanDepartment(department);
  const explanation = norm(reason);
  if (explanation.length < 5 || explanation.length > 500) {
    throw new Error("Provide a void reason between 5 and 500 characters.");
  }
  const officer = await requireTabAccess("tab-void", dept);
  const officerName = norm((officer as any)?.fullName || officer?.name || officer?.email) || "Authorized Officer";
  const org = await getOrganization(dept);
  const result = await serializable(async tx => {
    const penalty = await tx.penalty.findFirst({ where: {
      organizationId: org.id, id: norm(recordId),
    } });
    if (!penalty) throw new Error("Penalty not found.");
    if (isVoided(penalty.status)) throw new Error("This penalty was already voided.");
    await requireOpenPeriod(tx, org.id, penalty.academicYear, penalty.term);
    // Payment receipts lack a direct penaltyId column in the current schema.
    // Conservatively refuse voiding if cash-payment history is present.
    if (/CASH|PAID/i.test(norm(penalty.status))) {
      throw new Error("Cash payment activity exists for this fine. Reconcile its receipt(s) before voiding the penalty.");
    }
    // A later service credit can overwrite an older PARTIALLY PAID status.
    // Also examine historical settlement logs to avoid silently voiding a
    // penalty with legacy cash credits that lack a receipt/penalty link.
    const legacyCashSettlement = await tx.systemLog.findFirst({
      where: {
        organizationId: org.id,
        action: "SETTLE_PENALTY_CASH",
        details: { contains: penalty.penaltyId },
      },
      select: { id: true },
    });
    if (legacyCashSettlement) {
      throw new Error("This penalty has a legacy cash-settlement entry. Reconcile it before voiding the penalty.");
    }
    const student = penalty.studentId ? await tx.student.findFirst({
      where: { organizationId: org.id, studentId: { equals: penalty.studentId, mode: "insensitive" } },
      select: { id: true },
    }) : null;
    const receipts = await tx.collection.findMany({ where: {
      organizationId: org.id, academicYear: penalty.academicYear, term: penalty.term,
      OR: [
        { itemDescription: { equals: `Penalty Fine: ${penalty.activity}`, mode: "insensitive" } },
        { itemDescription: { contains: penalty.penaltyId, mode: "insensitive" } },
      ],
      AND: [{ OR: [
        ...(student ? [{ studentId: student.id }] : []),
        { studentName: { equals: penalty.studentName, mode: "insensitive" as const } },
      ] }],
    }, select: { id: true, status: true, paymentType: true } });
    if (receipts.some(receipt => !isVoided(receipt.status) && !isVoided(receipt.paymentType))) {
      throw new Error("An active cash receipt appears to be associated with this fine. Reverse/reconcile the receipt first.");
    }
    await tx.penalty.update({ where: { id: penalty.id }, data: { status: `Voided: ${explanation}` } });
    await tx.voidTransaction.create({ data: {
      organizationId: org.id,
      transactionType: "PENALTIES",
      referenceId: penalty.penaltyId,
      amount: penalty.fineAmount,
      reason: explanation,
      voidedBy: officerName,
    } });
    await tx.systemLog.create({ data: {
      organizationId: org.id,
      user: officerName,
      action: "VOID_PENALTY",
      details: `${penalty.penaltyId} (record ${penalty.id}): outstanding ₱${Number(penalty.fineAmount).toFixed(2)}; ${penalty.academicYear} ${penalty.term}. Reason: ${explanation}.`,
    } });
    return { success: true, message: "Penalty voided with audit trail (not deleted)." };
  });
  refreshPenaltyViews(dept);
  return result;
}
