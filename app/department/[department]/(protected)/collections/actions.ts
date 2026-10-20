"use server";
import { parseClearAccountingDate } from '@/lib/clear-timezone';

import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import { enqueuePaymentReceipt, scheduleDigitalReceiptDispatch } from "@/lib/digital-receipts";
import { revalidatePath } from "next/cache";
import { withFinancialTransaction } from "@/lib/financial-transaction";
import { allocateOfficialReceiptNumber } from "@/lib/receipt-number";
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

export async function recordPayment(department: string, data: {
  orNumber?: string; date: string; studentId: string; studentName: string;
  studentEmail?: string; category: string; itemDescription: string;
  paymentType: string; standardRate: number; amountPaid: number;
  fundAllocation: string; ay: string; term: string; penaltyId?: string;
}) {
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();
  const officer = await requireTabAccess("tab-payment", cleanDepartment);
  const officerName = String(officer.name || officer.fullName || officer.email || "System Administrator");
  const org = await prisma.organization.findUnique({ where: { subdomain: cleanDepartment },
    select: { id: true, name: true, reportSchoolName: true } });
  if (!org) throw new Error("Department not found.");

  const ay = String(data.ay || "").trim();
  const term = String(data.term || "").trim();
  const category = String(data.category || "").trim();
  const itemDescription = String(data.itemDescription || "").trim();
  let orNumber = "";
  const fundAllocation = String(data.fundAllocation || "").trim();
  const paid = money(data.amountPaid, "Payment");
  const date = dateOnly(data.date);
  if (!ay || !term || !category || !itemDescription || !data.studentId) {
    throw new Error("Student, category, item, academic year and term are required.");
  }

  let actualPaymentType = "Partial Payment";
  let balanceDue = 0;
  let studentName = "";
  let studentEmail = "";
  let paymentEntries = 0;
  let postedDescription = itemDescription;

  const postOnce = async () => withFinancialTransaction(async (tx) => {
    await assertAcademicPeriod(tx, org.id, ay, term);
    const ledger = await getPeriodLedger(tx, org.id, ay, term);
    if (ledger.activeRollover) throw new Error("This academic term is closed by a carry-over. Reverse the rollover before recording payments.");

    const student = await tx.student.findFirst({
      where: { organizationId: org.id, OR: [
        { studentId: { equals: String(data.studentId).trim(), mode: "insensitive" } },
        { id: String(data.studentId).trim() },
      ] },
    });
    if (!student) throw new Error("Student is not registered in this department.");
    studentName = student.fullName;
    studentEmail = String(student.email || "").trim();

    orNumber = await allocateOfficialReceiptNumber(tx, org.id);

    const existing = await tx.collection.findMany({ where: {
      organizationId: org.id, academicYear: ay, term, studentId: student.id,
    }, select: { itemDescription: true, amountPaid: true, status: true, paymentType: true } });
    const valid = existing.filter((row) => !String(row.status || "").toUpperCase().includes("VOID") &&
      !String(row.status || "").toUpperCase().includes("CANCEL") &&
      !String(row.paymentType || "").toUpperCase().includes("VOID"));
    const prevFor = (description: string) => valid.filter((c) =>
      String(c.itemDescription).trim().toLowerCase() === description.toLowerCase()
    ).reduce((total, c) => total + toCents(c.amountPaid), 0);

    const packageItems = await tx.collectionSetup.findMany({ where: {
      organizationId: org.id, academicYear: ay, term, category, isPackage: true,
    }, orderBy: { name: "asc" } });

    type PaymentEntry = { name: string; fund: string; rateCents: number; paidCents: number; balanceCents: number };
    const entries: PaymentEntry[] = [];
    const paidCents = toCents(paid);
    const penaltyId = String(data.penaltyId || "").trim();

    if (penaltyId) {
      // The penalty and receipt are changed as ONE atomic transaction. A failed
      // receipt write never reduces the fine; a failed penalty update rolls back
      // the receipt. Neither a status sent by the browser nor the URL is trusted.
      const pen = await tx.penalty.findFirst({ where: {
        organizationId: org.id, penaltyId, academicYear: ay, term,
      } });
      if (!pen) throw new Error("The penalty does not belong to this department or academic term.");
      const status = String(pen.status || "").trim();
      if (/VOID|CANCEL/i.test(status)) throw new Error("This penalty has been voided and cannot receive a payment.");
      if (/^SETTLED/i.test(status)) {
        throw new Error("This penalty is marked settled. If no cash receipt exists, an administrator must reconcile the legacy settlement in Penalty Logs before accepting payment.");
      }
      const due = toCents(pen.fineAmount);
      if (due <= 0) throw new Error("This penalty has no outstanding amount. Administrator reconciliation is required if this is incorrect.");
      if (paidCents > due) {
        throw new Error(`Payment exceeds the outstanding fine of ₱${(due / 100).toFixed(2)}.`);
      }
      if (!pen.studentId || pen.studentId.trim().toLowerCase() !== student.studentId.trim().toLowerCase()) {
        throw new Error("The selected student does not own this penalty. No receipt was posted.");
      }
      if (pen.penaltyType !== "LATE_FEE" && toCents(pen.ratePerHour) <= 0) {
        throw new Error("This service-eligible penalty's hourly rate is invalid.");
      }
      const remaining = due - paidCents;
      // ENFORCED SYSTEM-WIDE: the browser cannot choose a penalty destination.
      // A missing pool (legacy tenant/term) is created without moving prior funds.
      await ensurePenaltyFund(tx, org.id, ay, term);
      const selectedFund = PENALTY_FUND_NAME;
      // Reference the exact penalty in both the receipt and the audit log;
      // schema.prisma currently has no Collection.penaltyId foreign key.
      const penaltyDescription = `Penalty Fine [${pen.penaltyId}]: ${pen.activity}`;
      entries.push({ name: penaltyDescription, fund: selectedFund, rateCents: due,
        paidCents, balanceCents: remaining });
      balanceDue = remaining / 100;
      // The write order below is Collection first, Penalty second, SystemLog
      // third. Prisma commits all of them together, or none of them.
      // A conditional update prevents a simultaneous payment overwriting a
      // changed balance even if transaction retries are required.
    } else if (itemDescription === PACKAGE_NAME) {
      if (packageItems.length === 0) throw new Error("No mandatory package items are configured for this category.");
      // Legacy single-row package receipts count toward the overall assessment.
      let legacyCredits = prevFor(PACKAGE_NAME);
      const itemState = packageItems.map((setup) => {
        const rateCents = toCents(setup.amount);
        const existingPaid = prevFor(String(setup.name));
        const available = Math.max(0, rateCents - existingPaid);
        const appliedLegacy = Math.min(legacyCredits, available);
        legacyCredits -= appliedLegacy;
        return { setup, rateCents, available: available - appliedLegacy, already: existingPaid + appliedLegacy };
      });
      const capacity = itemState.reduce((n, item) => n + item.available, 0);
      if (paidCents > capacity) throw new Error(`Payment exceeds the remaining package balance of ₱${(capacity / 100).toFixed(2)}.`);
      let left = paidCents;
      for (const item of itemState) {
        const piece = Math.min(item.available, left);
        if (piece <= 0) continue;
        if (!String(item.setup.targetFund || "").trim()) throw new Error(`Package item ${item.setup.name} has no assigned fund.`);
        entries.push({ name: String(item.setup.name), fund: String(item.setup.targetFund),
          rateCents: item.rateCents, paidCents: piece, balanceCents: item.available - piece });
        left -= piece;
      }
      if (left !== 0 || entries.length === 0) throw new Error("Unable to allocate this package payment.");
      balanceDue = (capacity - paidCents) / 100;
    } else {
      // Do not allow penalty-looking receipts through the generic fee route;
      // they would post income but leave the penalty balance unchanged.
      if (/^Penalty Fine\s*(?:\[|:)/i.test(itemDescription) || /^penalt(?:y|ies)$/i.test(category)) {
        throw new Error("Penalty payments must start from Penalty Logs → Pay in Cash and include the penalty reference.");
      }
      // Trust the configured rate/fund instead of editable client input when there is a matching setup.
      const setup = await tx.collectionSetup.findFirst({ where: {
        organizationId: org.id, academicYear: ay, term, category,
        name: itemDescription,
      } });
      const rateCents = setup ? toCents(setup.amount) : toCents(money(data.standardRate, "Standard rate"));
      const previous = prevFor(itemDescription);
      const remaining = Math.max(0, rateCents - previous);
      if (paidCents > remaining) throw new Error(`Payment exceeds the remaining due of ₱${(remaining / 100).toFixed(2)}.`);
      const fund = String(setup?.targetFund || fundAllocation).trim();
      if (!fund || fund === "Multiple Funds (Package Split)") throw new Error("Choose a valid destination fund.");
      entries.push({ name: itemDescription, fund, rateCents, paidCents,
        balanceCents: remaining - paidCents });
      balanceDue = (remaining - paidCents) / 100;
    }

    actualPaymentType = balanceDue === 0 ? "Full Payment" : "Partial Payment";
    if (penaltyId) postedDescription = entries[0]?.name || itemDescription;
    paymentEntries = entries.length;
    let firstReceiptId: string | null = null;
    for (const [index, entry] of entries.entries()) {
      const createdReceipt = await tx.collection.create({ data: {
        organizationId: org.id, academicYear: ay, term, date,
        studentId: student.id, studentName,
        orNumber: index === 0 ? orNumber : `${orNumber}-P${String(index + 1).padStart(2, "0")}`,
        category, itemDescription: entry.name,
        paymentType: entry.balanceCents === 0 ? "Full Payment" : "Partial Payment",
        standardRate: entry.rateCents / 100,
        amountPaid: entry.paidCents / 100,
        balanceDue: entry.balanceCents / 100,
        fundAllocation: entry.fund, status: "Valid", encodedBy: officerName,
      } });
      if (index === 0) firstReceiptId = createdReceipt.id;
    }
    if (penaltyId) {
      // A receipt has been created above; only now change the penalty balance.
      const penalty = await tx.penalty.findFirst({ where: {
        organizationId: org.id, penaltyId, academicYear: ay, term,
      } });
      if (!penalty) throw new Error("Penalty changed while recording the payment.");
      const before = toCents(penalty.fineAmount);
      const after = before - paidCents;
      if (after < 0 || /^SETTLED/i.test(penalty.status || "") || /VOID|CANCEL/i.test(penalty.status || "")) {
        throw new Error("The penalty balance or status changed. No receipt has been saved; refresh the page.");
      }
      const newStatus = after === 0 ? "Settled (Cash Payment)" : "Partially Paid (Cash Payment)";
      const result = await tx.penalty.updateMany({
        where: {
          id: penalty.id, organizationId: org.id, academicYear: ay, term,
          fineAmount: penalty.fineAmount, status: penalty.status,
        },
        data: { fineAmount: after / 100, status: newStatus },
      });
      if (result.count !== 1) throw new Error("Concurrent penalty update detected; the payment was not recorded.");
      balanceDue = after / 100;
      if (!firstReceiptId) throw new Error("Penalty receipt reference was not created.");
      await tx.penaltySettlementEvent.create({ data: {
        organizationId: org.id, penaltyRecordId: penalty.id,
        receiptId: firstReceiptId, method: "CASH_PAYMENT", amount: paidCents / 100,
        accountingAY: ay, accountingTerm: term,
        balanceBefore: before / 100, balanceAfter: after / 100,
        recordedBy: officerName, note: `Official Receipt ${orNumber}`,
      } });
      await tx.systemLog.create({ data: {
        organizationId: org.id, user: officerName, action: "RECORD_PENALTY_PAYMENT",
        details: `Penalty ${penalty.penaltyId}; OR ${orNumber}; student ${student.studentId}; collected ₱${paid.toFixed(2)}; before ₱${(before / 100).toFixed(2)}; after ₱${(after / 100).toFixed(2)}; ${newStatus}; ${ay} ${term}.`,
      } });
    }
    if (!penaltyId && itemDescription !== PACKAGE_NAME) {
      await applyPaymentToStudentCollectibles(tx, {
        organizationId: org.id, academicYear: ay, term,
        studentId: student.studentId, category: category, itemDescription, amountCents: paidCents,
      });
    }
    await tx.systemLog.create({ data: {
      organizationId: org.id, user: officerName, action: "RECORD_PAYMENT",
      details: `OR ${orNumber}: ₱${paid.toFixed(2)} from ${studentName} for ${penaltyId ? `penalty ${penaltyId}` : itemDescription}, across ${entries.length} fund line(s).`,
    } });
    await enqueuePaymentReceipt(tx, { organizationId: org.id, orNumber, officerName, officerEmail: String(officer.email || ""), source: "COLLECTION" });
  });

  await postOnce();

  // Digital receipts are delivered from the transactional outbox after commit.
  scheduleDigitalReceiptDispatch(org.id, `payment:${orNumber}`);
  for (const part of ["collections", "penalties", "clearance", "realign", "summary", "reports", "cashier-remittance", "collectibles"]) {
    revalidatePath(`/department/${cleanDepartment}/${part}`);
  }
  revalidatePath(`/department/${cleanDepartment}`);
  return { success: true, orNumber, balanceDue, paymentEntries, paymentType: actualPaymentType, itemDescription: postedDescription };
}
