// app/department/[department]/(protected)/collectibles/actions.ts
"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { getPeriodLedger } from "../realign/ledger";
import { activeCollectibleDue, decodeStudentDue } from "./due-link";
import { assertAcademicPeriod } from "@/lib/academic-period-guard";
import { voidStudentCollectibleAssessment } from "./assessment-void";

function required(value: unknown, name: string): string {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${name} is required.`);
  return text;
}

async function context(department: string) {
  let slug: string;
  try {
    slug = decodeURIComponent(String(department || "")).trim().toLowerCase();
  } catch {
    throw new Error("Invalid department identifier.");
  }
  const officer = await requireTabAccess("tab-collectibles", slug);
  const org = await prisma.organization.findUnique({
    where: { subdomain: slug },
    select: { id: true },
  });
  if (!org) throw new Error("Department not found.");
  return {
    slug, organizationId: org.id,
    officerName: String(officer.fullName || officer.name || officer.email || "Officer"),
  };
}

function refresh(department: string) {
  for (const suffix of ["collectibles", "collections", "clearance", "summary", "reports"]) {
    revalidatePath(`/department/${department}/${suffix}`);
  }
}

/**
 * The browser submits a fee ID, never an arbitrary amount/category/fund.
 * All payable details are loaded from the current tenant's CollectionSetup row.
 */
export async function assessStudentDue(department: string, data: {
  studentId: string;
  feeId: string;
  date: string;
  ay: string;
  term: string;
}) {
  const { slug, organizationId, officerName } = await context(department);
  const ay = required(data.ay, "Academic year");
  const term = required(data.term, "Term");
  const studentId = required(data.studentId, "Student ID");
  const feeId = required(data.feeId, "Configured fee");
  const inputDate = required(data.date, "Assessment date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inputDate) ||
    !Number.isFinite(new Date(`${inputDate}T00:00:00Z`).getTime())) {
    throw new Error("Enter a valid assessment date.");
  }

  const period = { organizationId, academicYear: ay, term };
  let details = "";
  await prisma.$transaction(async (tx) => {
    await assertAcademicPeriod(tx, organizationId, ay, term);
    const ledger = await getPeriodLedger(tx, organizationId, ay, term);
    if (ledger.activeRollover) {
      throw new Error("This period is closed by a term rollover; new receivables cannot be assessed.");
    }

    const [student, fee] = await Promise.all([
      tx.student.findFirst({
        where: { organizationId, studentId: { equals: studentId, mode: "insensitive" } },
        select: { studentId: true, fullName: true },
      }),
      tx.collectionSetup.findFirst({
        where: { id: feeId, ...period, isPackage: false },
        select: { id: true, category: true, name: true, amount: true, targetFund: true },
      }),
    ]);
    if (!student) throw new Error("Student was not found in this department.");
    if (!fee) throw new Error("This fee is not configured as a standalone item for the selected term. Refresh the page.");

    const feeCents = Math.round(Number(fee.amount) * 100);
    if (!Number.isSafeInteger(feeCents) || feeCents <= 0 ||
      Math.abs(Number(fee.amount) * 100 - feeCents) > 0.00001) {
      throw new Error("This configured fee has an invalid amount. Correct it in Setup Collection Fees.");
    }

    // Match the fund configured for this exact period. Do not trust a client-side fund selection.
    const fund = await tx.fund.findFirst({
      where: { ...period, fundName: fee.targetFund },
      select: { id: true },
    });
    if (!fund) {
      throw new Error(`The target fund '${fee.targetFund}' is not configured for this term. Update Fee Setup first.`);
    }

    // Prevent two outstanding assessments for the same student and fee.
    // This schema stores student/description in the status marker until a migration adds columns.
    const existing = await tx.collectible.findMany({ where: period });
    const duplicate = existing.some((due) => {
      if (!activeCollectibleDue(due)) return false;
      const marker = decodeStudentDue(due.status);
      return Boolean(marker &&
        marker.studentId.toLowerCase() === student.studentId.toLowerCase() &&
        marker.itemDescription.trim().toLowerCase() === fee.name.trim().toLowerCase() &&
        due.category.trim().toLowerCase() === fee.category.trim().toLowerCase());
    });
    if (duplicate) {
      throw new Error("An unpaid assessment for this fee already exists for this student. Settle it before creating another.");
    }

    const status = `Unpaid|SID:${encodeURIComponent(student.studentId)}|ITEM:${encodeURIComponent(fee.name)}`;
    const assessed = await tx.collectible.create({
      data: {
        ...period,
        category: fee.category,
        headcount: 1,
        balanceDue: feeCents / 100,
        status,
        encodedBy: officerName,
      },
      select: { id: true },
    });
    details = `Assessment ${assessed.id}: ${student.fullName} (${student.studentId}); ` +
      `${fee.category} / ${fee.name}; ₱${(feeCents / 100).toFixed(2)}; ` +
      `destination fund ${fee.targetFund}; assessment date ${inputDate}; academic period ${ay} / ${term}.`;
    await tx.systemLog.create({
      data: { organizationId, user: officerName, action: "ASSESS_STUDENT_DUE", details },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });

  refresh(slug);
  return { success: true, message: "Configured standalone fee assessed. Clearance hold active until payment." };
}

// Existing bulk assessment functionality is retained for compatibility with other modules.
// It remains an administrative, summary-level receivable, not an individually linked fee.
export async function saveBulkCollectibles(
  department: string,
  records: { category: string; headcount: number; total: number }[],
  ayInput: string,
  termInput: string
) {
  const { slug, organizationId, officerName } = await context(department);
  const ay = required(ayInput, "Academic year");
  const term = required(termInput, "Term");
  if (!Array.isArray(records) || records.length < 1 || records.length > 2000) {
    throw new Error("Bulk assessment requires 1–2000 records.");
  }
  const period = { organizationId, academicYear: ay, term };
  const validRows = records.map((row) => {
    const category = required(row.category, "Category");
    const headcount = Number(row.headcount);
    const cents = Math.round(Number(row.total) * 100);
    if (!Number.isSafeInteger(headcount) || headcount <= 0) {
      throw new Error("Headcount must be a positive whole number.");
    }
    if (!Number.isSafeInteger(cents) || cents <= 0 ||
      Math.abs(Number(row.total) * 100 - cents) > 0.00001) {
      throw new Error("Bulk assessment must have a positive, centavo-precision total.");
    }
    return { ...period, category, headcount, balanceDue: cents / 100, status: "Outstanding", encodedBy: officerName };
  });
  await prisma.$transaction(async (tx) => {
    const ledger = await getPeriodLedger(tx, organizationId, ay, term);
    if (ledger.activeRollover) throw new Error("This period is closed by rollover.");
    // Bulk categories also must originate from the period's fee setup.
    const configured = await tx.collectionSetup.findMany({
      where: { ...period, isPackage: false }, select: { category: true },
    });
    const validCategories = new Set(configured.map((fee) => fee.category.trim().toLowerCase()));
    for (const row of validRows) {
      if (!validCategories.has(row.category.trim().toLowerCase())) {
        throw new Error(`Category '${row.category}' is not configured as a standalone fee for this term.`);
      }
    }
    await tx.collectible.createMany({ data: validRows });
    await tx.systemLog.create({
      data: {
        organizationId, user: officerName, action: "SAVE_BULK_COLLECTIBLES",
        details: `Recorded ${validRows.length} bulk receivable categories for ${term} (${ay}).`,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
  refresh(slug);
  return { success: true, count: validRows.length };
}

/** An authorized assessment reversal; never a cash-receipt reversal.
 * Officers must void and reconcile associated ORs through the Void Center first.
 */
export async function voidCollectibleAssessment(
  department: string,
  args: { collectibleId: string; reason: string; ay: string; term: string },
) {
  const { slug, organizationId, officerName } = await context(department);
  // A Collectibles officer without Void Center access must not reverse debts.
  await requireTabAccess("tab-void", slug);
  const collectibleId = required(args.collectibleId, "Assessment ID");
  const ay = required(args.ay, "Academic year");
  const term = required(args.term, "Academic term");
  const reason = required(args.reason, "Void reason");
  if (reason.length < 10 || reason.length > 500) {
    throw new Error("Enter a meaningful void reason (10–500 characters).");
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        const due = await tx.collectible.findFirst({
          where: { id: collectibleId, organizationId },
          select: { academicYear: true, term: true },
        });
        if (!due) throw new Error("Assessment not found in this organization.");
        if (due.academicYear !== ay || due.term !== term) {
          throw new Error("The assessment belongs to a different academic period. Refresh before continuing.");
        }
        await assertAcademicPeriod(tx, organizationId, ay, term);
        const ledger = await getPeriodLedger(tx, organizationId, ay, term);
        if (ledger.activeRollover) {
          throw new Error("This academic period is closed; reopen it through the authorized rollover procedure before reversing assessments.");
        }
        const outcome = await voidStudentCollectibleAssessment(tx, { organizationId, collectibleId, reason });
        await tx.voidTransaction.create({ data: {
          organizationId, transactionType: "COLLECTIBLES",
          referenceId: outcome.id, amount: outcome.amount, reason, voidedBy: officerName,
        } });
        await tx.systemLog.create({ data: {
          organizationId, user: officerName, action: "VOID_COLLECTIBLE_ASSESSMENT",
          details: outcome.details,
        } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 20000 });
      refresh(slug);
      revalidatePath(`/department/${slug}/void`);
      revalidatePath(`/department/${slug}/logs`);
      revalidatePath(`/department/${slug}/collections/arrears`);
      return { success: true, message: "Unpaid assessment reversed, clearance hold removed, and audit record saved." };
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("A concurrent update prevented reversal. Refresh and retry.");
}
