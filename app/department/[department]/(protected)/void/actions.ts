// app/department/[department]/(protected)/void/actions.ts
"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withFinancialTransaction } from "@/lib/financial-transaction";
import { revalidatePath } from "next/cache";
import { requireTabAccess, requireOrgAdmin } from "@/lib/permissions";
import { getPeriodLedger } from "../realign/ledger";
import { decodeStudentDue } from "../collectibles/due-link";
import { voidStudentCollectibleAssessment } from "../collectibles/assessment-void";
import { assertAcademicPeriod } from "@/lib/academic-period-guard";

const ALLOWED_CATEGORIES = new Set([
  "collections", "penalties", "advances", "collectibles", "liquidations",
]);

const clean = (value: unknown): string => String(value ?? "").trim();
const isVoided = (value: unknown): boolean => /VOID|CANCEL/i.test(clean(value));
const receiptSuffix = /-P\d{2,}$/i;

function normalizeDepartment(value: unknown): string {
  try {
    return decodeURIComponent(clean(value)).toLowerCase();
  } catch {
    throw new Error("Invalid department identifier.");
  }
}

function money(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error("An invalid monetary amount was encountered.");
  return Math.round(amount * 100) / 100;
}

/** Restore linked standalone assessments when a receipt is reversed.
 * The schema has no Collection.collectibleId: only exact tenant, period,
 * student, category, and item matches are safe to apply automatically.
 * This runs INSIDE the existing receipt-void serializable transaction.
 */
async function restoreCollectiblePayments(
  tx: Prisma.TransactionClient,
  organizationId: string,
  ay: string,
  term: string,
  receiptRows: Array<{
    id: string; studentId: string | null; category: string;
    itemDescription: string; amountPaid: number; orNumber: string;
  }>,
  officerName: string,
  baseOR: string
): Promise<number> {
  const grouped = new Map<string, {
    studentPk: string; category: string; item: string; amountCents: number;
  }>();
  for (const receipt of receiptRows) {
    if (!receipt.studentId || /^Penalty Fine\s*(?:\[|:)/i.test(receipt.itemDescription)) continue;
    const cents = Math.round(Number(receipt.amountPaid) * 100);
    if (!Number.isSafeInteger(cents) || cents <= 0) {
      throw new Error("The receipt has an invalid collectible payment amount.");
    }
    const category = clean(receipt.category);
    const item = clean(receipt.itemDescription);
    const key = `${receipt.studentId}\u0000${category.toLowerCase()}\u0000${item.toLowerCase()}`;
    const previous = grouped.get(key);
    grouped.set(key, {
      studentPk: receipt.studentId, category, item,
      amountCents: (previous?.amountCents || 0) + cents,
    });
  }
  let restoredCount = 0;
  for (const payment of grouped.values()) {
    const student = await tx.student.findFirst({
      where: { id: payment.studentPk, organizationId },
      select: { studentId: true },
    });
    if (!student) throw new Error("The payment student is missing; manual reconciliation is required.");
    const candidates = await tx.collectible.findMany({
      where: { organizationId, academicYear: ay, term,
        category: { equals: payment.category, mode: "insensitive" } },
    });
    const matches = candidates.filter((due) => {
      const marker = decodeStudentDue(due.status);
      return marker &&
        marker.studentId.toLowerCase() === student.studentId.toLowerCase() &&
        marker.itemDescription.trim().toLowerCase() === payment.item.toLowerCase();
    });
    if (matches.length === 0) continue; // Ordinary collections without an assessment.
    if (matches.length !== 1) {
      throw new Error("Multiple assessments match this receipt; restore the student due through audited reconciliation.");
    }
    const due = matches[0];
    if (isVoided(due.status)) {
      throw new Error("The linked student assessment is voided; reconcile it before voiding this receipt.");
    }
    const configuredFees = await tx.collectionSetup.findMany({ where: {
      organizationId, academicYear: ay, term,
      category: { equals: payment.category, mode: "insensitive" },
      name: { equals: payment.item, mode: "insensitive" },
      isPackage: false,
    }, select: { amount: true } });
    if (configuredFees.length !== 1) {
      throw new Error("The linked standalone fee configuration is missing or ambiguous; manual reconciliation is required.");
    }
    const cap = Math.round(Number(configuredFees[0].amount) * 100);
    const prior = Math.round(Number(due.balanceDue) * 100);
    const next = prior + payment.amountCents;
    if (![cap, prior, next].every(Number.isSafeInteger) || cap <= 0 || prior < 0 || next > cap) {
      throw new Error("Voiding this receipt would overstate the student's assessed fee. Reconciliation required.");
    }
    const result = await tx.collectible.updateMany({
      where: { id: due.id, organizationId, balanceDue: due.balanceDue, status: due.status },
      data: {
        balanceDue: next / 100,
        status: String(due.status).replace(/^Paid/i, "Unpaid"),
      },
    });
    if (result.count !== 1) throw new Error("Assessment changed concurrently; receipt reversal rolled back.");
    restoredCount++;
    await tx.systemLog.create({ data: {
      organizationId, user: officerName, action: "RESTORE_COLLECTIBLE_PAYMENT",
      details: `OR ${baseOR}; assessment ${due.id}; student ${student.studentId}; ` +
        `${payment.category} / ${payment.item}; restored ₱${(payment.amountCents / 100).toFixed(2)}; ` +
        `balance ₱${(prior / 100).toFixed(2)} → ₱${(next / 100).toFixed(2)}; ${ay} ${term}.`,
    } });
  }
  return restoredCount;
}

export async function executeVoidTransaction(formData: {
  department: string;
  category: string;
  referenceId: string;
  reason: string;
  ay?: string;
  term?: string;
  /** Required only for ambiguous legacy receipts lacking [penaltyId]. */
  legacyPenaltyId?: string;
}) {
  const department = normalizeDepartment(formData.department);
  const category = clean(formData.category).toLowerCase();
  const referenceId = clean(formData.referenceId);
  const reason = clean(formData.reason);
  const selectedAY = clean(formData.ay);
  const selectedTerm = clean(formData.term);
  const legacyPenaltyId = clean(formData.legacyPenaltyId);

  if (!department || !referenceId || !ALLOWED_CATEGORIES.has(category)) {
    throw new Error("Invalid department, category, or reference ID.");
  }
  if (reason.length < 5 || reason.length > 500) {
    throw new Error("The void reason must contain between 5 and 500 characters.");
  }

  const officer = await requireTabAccess("tab-void", department);
  const officerName = clean(
    (officer as any)?.fullName || officer?.name || officer?.email
  ) || "Authorized Officer";

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department },
    select: { id: true },
  });
  if (!organization) throw new Error("Department not found.");

  // All status mutations and audit entries are atomic. This also prevents
  // accepting a second void of the same record in concurrent requests.
  const result = await withFinancialTransaction(async (tx) => {
    let affectedRecordIds: string[] = [];
    let amount = 0;
    let ay = "";
    let term = "";
    let details = "";
    let voidReference = referenceId;

    const checkOpenTerm = async (periodAY: string, periodTerm: string) => {
      if (selectedAY && selectedAY !== periodAY) {
        throw new Error("This transaction does not belong to the selected academic year.");
      }
      if (selectedTerm && selectedTerm !== periodTerm) {
        throw new Error("This transaction does not belong to the selected term.");
      }
      const ledger = await getPeriodLedger(tx, organization.id, periodAY, periodTerm);
      if (ledger.activeRollover) {
        throw new Error("This term has already been carried over. Reverse its rollover before voiding transactions.");
      }
      return ledger;
    };

    if (category === "collections") {
      // Payment-package receipts can have a main OR and -P02/-P03 allocation
      // lines, or legacy rows that share exactly the same OR. Void all lines.
      // Scope by period, student and tenant to avoid affecting unrelated data.
      if (!selectedAY || !selectedTerm) {
        throw new Error("Academic year and term are required when voiding a receipt.");
      }
      const first = await tx.collection.findFirst({
        where: {
          organizationId: organization.id,
          academicYear: selectedAY,
          term: selectedTerm,
          orNumber: referenceId,
        },
      });
      if (!first) throw new Error("Official receipt not found in the selected term.");

      ay = first.academicYear;
      term = first.term;
      const beforeLedger = await checkOpenTerm(ay, term);

      const baseCandidate = referenceId.replace(receiptSuffix, "");
      const parent = baseCandidate !== referenceId
        ? await tx.collection.findFirst({ where: {
            organizationId: organization.id,
            academicYear: ay,
            term,
            orNumber: baseCandidate,
          } })
        : null;

      const sameStudent = (row: typeof first) => (
        first.studentId && row.studentId
          ? first.studentId === row.studentId
          : clean(first.studentName).toLowerCase() === clean(row.studentName).toLowerCase()
      );
      const baseOR = parent && sameStudent(parent) ? baseCandidate : referenceId;
      const candidates = await tx.collection.findMany({
        where: {
          organizationId: organization.id,
          academicYear: ay,
          term,
          OR: [
            { orNumber: baseOR },
            { orNumber: { startsWith: `${baseOR}-P` } },
          ],
        },
      });
      const suffixPattern = new RegExp(`^${baseOR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-P\\d{2,}$`, "i");
      const receiptRows = candidates.filter(
        (row) => row.orNumber === baseOR || suffixPattern.test(row.orNumber)
      );
      if (!receiptRows.length) throw new Error("Receipt allocation lines not found.");
      if (receiptRows.some(row => !sameStudent(row))) {
        throw new Error("Receipt number is shared by different students. Reconcile that receipt before voiding it.");
      }
      if (receiptRows.some(row => isVoided(row.status) || isVoided(row.paymentType))) {
        throw new Error("Some or all receipt allocations are already voided. Reconcile the receipt before proceeding.");
      }

      // Explicit cross-period receipt links are authoritative; a current-year OR
      // may settle a debt originating in a previously closed academic year.
      const arrearLinks = await tx.arrearPaymentLink.findMany({
        where: { organizationId: organization.id, receiptId: { in: receiptRows.map(r => r.id) } },
      });
      if (arrearLinks.length && arrearLinks.length !== receiptRows.length) {
        throw new Error("This OR mixes linked historical and ordinary transactions. Accounting reconciliation required.");
      }
      // LINKED CASH-PENALTY REVERSAL — either BOTH the receipt and penalty
      // balance change in one transaction, or NOTHING changes.
      // New receipts store `Penalty Fine [PEN-...]: activity` (no schema FK).
      // Old receipts store `Penalty Fine: activity` and require an admin to
      // explicitly supply and verify the penalty reference.
      const penaltyRows = arrearLinks.length ? [] : receiptRows.filter(row =>
        /^Penalty Fine\s*(?:\[|:)/i.test(clean(row.itemDescription))
      );
      let penaltyRestoration:
        | { id: string; ref: string; originalStatus: string; oldCents: number;
            newCents: number; nextStatus: string; fundNames: string[] }
        | null = null;
      if (penaltyRows.length > 0) {
        if (penaltyRows.length !== receiptRows.length) {
          throw new Error("This OR mixes penalty and non-penalty lines. An accountant must reconcile it before voiding.");
        }
        const exactMatch = /^Penalty Fine\s*\[([^\]]+)\]:\s*(.*)$/i;
        const newMatches = penaltyRows.map(r => clean(r.itemDescription).match(exactMatch));
        const allNew = newMatches.every(Boolean);
        const allLegacy = newMatches.every(v => !v) && penaltyRows.every(r =>
          /^Penalty Fine\s*:\s*\S/i.test(clean(r.itemDescription))
        );
        if (!allNew && !allLegacy) {
          throw new Error("Mixed or unrecognized penalty receipt format. An audited manual correction is required.");
        }
        let penaltyRef = "";
        let legacyActivity = "";
        if (allNew) {
          penaltyRef = clean(newMatches[0]![1]);
          if (newMatches.some(m => clean(m![1]) !== penaltyRef)) {
            throw new Error("The OR contains multiple penalty references. Manual reconciliation is required.");
          }
          if (legacyPenaltyId && legacyPenaltyId !== penaltyRef) {
            throw new Error("The supplied penalty reference differs from the receipt's reference.");
          }
        } else {
          // A historical receipt is NOT intrinsically linked to a penalty.
          // Require an administrator's deliberate, explicit identification.
          if (!legacyPenaltyId) {
            throw new Error("Legacy penalty receipt: select the OR again and enter its exact PEN reference to perform an audited reversal.");
          }
          await requireOrgAdmin(department);
          penaltyRef = legacyPenaltyId;
          legacyActivity = clean(penaltyRows[0].itemDescription).replace(/^Penalty Fine\s*:\s*/i, "");
          if (penaltyRows.some(row =>
            clean(row.itemDescription).replace(/^Penalty Fine\s*:\s*/i, "").toLowerCase() !== legacyActivity.toLowerCase()
          )) {
            throw new Error("This legacy OR contains different penalty activities. Manual reconciliation is required.");
          }
        }
        const penalty = await tx.penalty.findFirst({ where: {
          organizationId: organization.id, academicYear: ay, term, penaltyId: penaltyRef,
        } });
        if (!penalty || isVoided(penalty.status)) {
          throw new Error("Linked penalty is missing or already voided. Nothing was changed.");
        }
        if (allLegacy && clean(penalty.activity).toLowerCase() !== legacyActivity.toLowerCase()) {
          throw new Error("The supplied penalty ID does not match this receipt's activity.");
        }
        if (!penalty.studentId) {
          throw new Error("Penalty lacks a student ID. Verify its identity through a manual accounting reconciliation.");
        }
        const student = await tx.student.findFirst({ where: {
          organizationId: organization.id,
          studentId: { equals: penalty.studentId, mode: "insensitive" },
        }, select: { id: true, fullName: true } });
        if (!student || receiptRows.some(row => row.studentId !== student.id)) {
          throw new Error("Penalty and receipt belong to different students, or identity cannot be verified.");
        }
        // Reject unexplained legacy cash-only settlements, which have no
        // receipt foreign key and could otherwise restore money twice.
        const oldCashOnly = await tx.systemLog.findFirst({ where: {
          organizationId: organization.id,
          action: "SETTLE_PENALTY_CASH",
          details: { contains: penaltyRef },
        }, select: { id: true } });
        if (oldCashOnly) {
          throw new Error("This fine has a legacy cash-only settlement log. Manual reconciliation is necessary before voiding its receipt.");
        }
        const refundCents = penaltyRows.reduce((sum, row) => {
          const cents = Math.round(Number(row.amountPaid) * 100);
          if (!Number.isSafeInteger(cents) || cents <= 0) {
            throw new Error("This penalty receipt has an invalid payment amount.");
          }
          return sum + cents;
        }, 0);
        const oldCents = Math.round(Number(penalty.fineAmount) * 100);
        const assessmentCap = penalty.assessedAmount != null
          ? Math.round(Number(penalty.assessedAmount) * 100)
          : Math.round(Number(penalty.hoursLate) * Number(penalty.ratePerHour) * 100);
        const newCents = oldCents + refundCents;
        if (![oldCents, assessmentCap, newCents].every(Number.isSafeInteger) ||
            oldCents < 0 || assessmentCap <= 0 || newCents > assessmentCap + 1) {
          throw new Error("Reversing this receipt would exceed the original assessed fine. A financial reconciliation is required.");
        }
        // Preserve evidence of any other still-valid penalty receipts.
        const potentialOtherReceipts = await tx.collection.findMany({ where: {
          organizationId: organization.id, academicYear: ay, term,
          studentId: student.id,
          OR: [
            { itemDescription: { startsWith: `Penalty Fine [${penaltyRef}]:` } },
            { itemDescription: { equals: `Penalty Fine: ${penalty.activity}`, mode: "insensitive" } },
          ],
        }, select: { id: true, status: true, paymentType: true } });
        const currentIds = new Set(receiptRows.map(row => row.id));
        const otherActiveCash = potentialOtherReceipts.some(row =>
          !currentIds.has(row.id) && !isVoided(row.status) && !isVoided(row.paymentType)
        );
        const serviceCredit = await tx.systemLog.findFirst({ where: {
          organizationId: organization.id,
          action: "SETTLE_PENALTY_SERVICE",
          details: { contains: penaltyRef },
        }, select: { id: true } });
        const nextStatus = otherActiveCash
          ? "Partially Paid (Receipt Reversed)"
          : serviceCredit
            ? "Partially Served (Receipt Reversed)"
            : "Unsettled (Receipt Reversed)";
        penaltyRestoration = {
          id: penalty.id, ref: penaltyRef, originalStatus: penalty.status,
          oldCents, newCents, nextStatus,
          fundNames: Array.from(new Set(penaltyRows.map(row => row.fundAllocation))),
        };
      }

      amount = money(receiptRows.reduce((sum, row) => sum + Number(row.amountPaid || 0), 0));
      affectedRecordIds = receiptRows.map(row => row.id);
      voidReference = baseOR;
      const updated = await tx.collection.updateMany({
        where: { organizationId: organization.id, id: { in: affectedRecordIds } },
        data: { status: "VOID", paymentType: "VOID (Reversed)" },
      });
      if (updated.count !== receiptRows.length) {
        throw new Error("Not all receipt allocations were updated. The reversal was rolled back.");
      }
      // Receivable restoration and OR void are a single atomic operation.
      // A failed restoration rolls back the receipt status and audit logs.
      const restoredCollectibles = penaltyRestoration || arrearLinks.length ? 0 : await restoreCollectiblePayments(
        tx, organization.id, ay, term, receiptRows, officerName, baseOR
      );
      for (const link of arrearLinks) {
        const cash = Math.round(Number(link.amount) * 100);
        if (!Number.isSafeInteger(cash) || cash <= 0) throw new Error("Invalid historical receipt link amount.");
        if (link.obligationType === "penalty") {
          const old = await tx.penalty.findFirst({ where: { id: link.obligationId, organizationId: organization.id,
            academicYear: link.originAY, term: link.originTerm } });
          if (!old || isVoided(old.status)) throw new Error("Original historical penalty missing or voided.");
          const ceiling = old.assessedAmount != null
            ? Math.round(Number(old.assessedAmount) * 100)
            : Math.round(Number(old.hoursLate) * Number(old.ratePerHour) * 100);
          const before = Math.round(Number(old.fineAmount) * 100);
          if (!Number.isSafeInteger(ceiling) || ceiling <= 0 || before + cash > ceiling + 1) {
            throw new Error("Restoring this penalty would exceed the recorded assessment; reconciliation required.");
          }
          const updated = await tx.penalty.updateMany({ where: {
            id: old.id, organizationId: organization.id, fineAmount: old.fineAmount, status: old.status },
            data: { fineAmount: (before + cash) / 100, status: "Unsettled (Arrear Receipt Reversed)" },
          });
          if (updated.count !== 1) throw new Error("Historical penalty changed concurrently.");
          await tx.penaltySettlementEvent.create({ data: {
            organizationId: organization.id, penaltyRecordId: old.id,
            receiptId: link.receiptId, method: "CASH_REVERSAL", amount: -cash / 100,
            accountingAY: ay, accountingTerm: term,
            balanceBefore: before / 100, balanceAfter: (before + cash) / 100,
            recordedBy: officerName, note: `Voided historical receipt ${baseOR}: ${reason}`,
          } });
        } else if (link.obligationType === "collectible") {
          const old = await tx.collectible.findFirst({ where: { id: link.obligationId, organizationId: organization.id,
            academicYear: link.originAY, term: link.originTerm } });
          if (!old || isVoided(old.status)) throw new Error("Original historical collectible missing or voided.");
          const identity = decodeStudentDue(old.status);
          if (!identity) throw new Error("Historical assessment lacks its student link.");
          const fees = await tx.collectionSetup.findMany({ where: { organizationId: organization.id,
            academicYear: link.originAY, term: link.originTerm, category: old.category,
            name: identity.itemDescription, isPackage: false } });
          if (fees.length !== 1) throw new Error("Original historical fee setup is ambiguous.");
          const before = Math.round(Number(old.balanceDue) * 100);
          const cap = Math.round(Number(fees[0].amount) * 100);
          if (before + cash > cap || before < 0) throw new Error("Historical collectible restoration exceeds its original assessment.");
          const updated = await tx.collectible.updateMany({ where: { id: old.id, organizationId: organization.id,
            balanceDue: old.balanceDue, status: old.status }, data: {
            balanceDue: (before + cash) / 100, status: String(old.status).replace(/^Paid/i, "Unpaid") } });
          if (updated.count !== 1) throw new Error("Historical collectible changed concurrently.");
        } else throw new Error("Unknown historical obligation link type.");
        await tx.systemLog.create({ data: { organizationId: organization.id,
          user: officerName, action: "REVERSE_HISTORICAL_ARREAR_PAYMENT",
          details: `OR ${baseOR}; restored ₱${(cash / 100).toFixed(2)} to original ${link.obligationType} ${link.obligationId} (${link.originTerm}, ${link.originAY}); authorized reason: ${reason}` } });
      }
      if (penaltyRestoration) {
        const restored = await tx.penalty.updateMany({
          where: {
            organizationId: organization.id, id: penaltyRestoration.id,
            fineAmount: penaltyRestoration.oldCents / 100,
            status: penaltyRestoration.originalStatus,
          },
          data: {
            fineAmount: penaltyRestoration.newCents / 100,
            status: penaltyRestoration.nextStatus,
          },
        });
        if (restored.count !== 1) {
          throw new Error("The linked fine changed concurrently. Receipt void was rolled back.");
        }
        let reversingBalance = penaltyRestoration.oldCents;
        for (const reversedReceipt of penaltyRows) {
          const reversedCents = Math.round(Number(reversedReceipt.amountPaid) * 100);
          await tx.penaltySettlementEvent.create({ data: {
            organizationId: organization.id, penaltyRecordId: penaltyRestoration.id,
            receiptId: reversedReceipt.id, method: "CASH_REVERSAL",
            amount: -reversedCents / 100,
            accountingAY: ay, accountingTerm: term,
            balanceBefore: reversingBalance / 100,
            balanceAfter: (reversingBalance + reversedCents) / 100,
            recordedBy: officerName,
            note: `Voided official receipt ${baseOR}: ${reason}`,
          } });
          reversingBalance += reversedCents;
        }
        await tx.systemLog.create({ data: {
          organizationId: organization.id,
          user: officerName,
          action: "REVERSE_PENALTY_PAYMENT",
          details: `Penalty ${penaltyRestoration.ref}; voided OR ${baseOR}; funds ${penaltyRestoration.fundNames.join(", ")}; outstanding before ₱${(penaltyRestoration.oldCents / 100).toFixed(2)}; outstanding after ₱${(penaltyRestoration.newCents / 100).toFixed(2)}; restored ₱${((penaltyRestoration.newCents - penaltyRestoration.oldCents) / 100).toFixed(2)}; ${ay} ${term}; reason: ${reason}.`,
        } });
      }

      // A verified online remittance is inseparable from its corresponding OR.
      // Updating it here (not in another action) makes the reversal atomic.
      const linkedRemittances = await tx.onlineRemittance.findMany({ where: {
        organizationId: organization.id, orNumber: baseOR,
        academicYear: ay, term,
      } });
      if (linkedRemittances.length > 1) {
        throw new Error("Multiple online remittances share this OR; manual reconciliation required.");
      }
      if (linkedRemittances.length === 1) {
        const remit = linkedRemittances[0];
        if (remit.status !== "Verified") {
          throw new Error("Linked remittance is not Verified; cannot independently reverse its OR.");
        }
        const originalCash = Math.round(Number(remit.amountPaid) * 100);
        if (originalCash !== Math.round(amount * 100)) {
          throw new Error("Approved remittance and OR allocations disagree; reconcile before reversal.");
        }
        const linkedStudent = await tx.student.findFirst({ where: {
          organizationId: organization.id, studentId: String(remit.studentId || "").trim(),
        }, select: { id: true } });
        if (!linkedStudent || receiptRows.some(row => row.studentId !== linkedStudent.id)) {
          throw new Error("Approved remittance and OR student do not match; reversal stopped.");
        }
        const changed = await tx.onlineRemittance.updateMany({ where: {
          id: remit.id, organizationId: organization.id, status: "Verified", orNumber: baseOR,
        }, data: {
          status: "Voided",
          reviewNotes: `Approved remittance reversed by ${officerName}. Reason: ${reason}`,
        } });
        if (changed.count !== 1) throw new Error("Remittance approval changed concurrently.");
        await tx.systemLog.create({ data: {
          organizationId: organization.id, user: officerName,
          action: "REVERSE_APPROVED_REMITTANCE",
          details: `Remittance ${remit.submissionId}; OR ${baseOR}; original proof ${remit.referenceNumber}; ₱${amount.toFixed(2)}; ${ay} ${term}; reason: ${reason}`,
        } });
      }

      // RECONCILIATION CHECKS (server-side, within the same transaction).
      // A void cancels income; cashier deposits merely change its location.
      // Check treasury insolvency FIRST so a negative overall balance is not
      // misleadingly reported as a cashier-deposit problem.
      const afterLedger = await getPeriodLedger(tx, organization.id, ay, term);
      const php = (value: number) => `₱${money(value).toFixed(2)}`;
      const originalBalances = new Map(beforeLedger.funds.map(f => [f.name, f.balance]));
      const worsenedFunds = afterLedger.funds.filter(f =>
        f.balance < -0.005 && f.balance < (originalBalances.get(f.name) ?? 0) - 0.005
      );
      const worsenedFundNames = worsenedFunds
        .map(f => `${f.name}: ${php(f.balance)}`)
        .join("; ");
      if (afterLedger.totalRemaining < -0.005) {
        throw new Error(
          `Cannot void OR ${baseOR}: treasury balance would change from ` +
          `${php(beforeLedger.totalRemaining)} to ${php(afterLedger.totalRemaining)} ` +
          `(a shortfall of ${php(-afterLedger.totalRemaining)}). ` +
          (worsenedFunds.length ? `Affected fund(s): ${worsenedFundNames}. ` : "") +
          "Correct an erroneous expense/advance/transfer using its authorized reversal workflow, or complete an audited financial reconciliation before attempting to void this receipt. " +
          "Moving cash to or from the University Cashier does not create new funds. No transaction was changed."
        );
      }
      if (afterLedger.cashierBalance < -0.005) {
        throw new Error("Cashier custody is already negative; reconcile cashier remittances before voiding. Nothing was changed.");
      }
      if (afterLedger.totalRemaining + 0.005 < afterLedger.cashierBalance) {
        throw new Error(
          `Cannot void OR ${baseOR}: remaining treasury funds would be ` +
          `${php(afterLedger.totalRemaining)} while ${php(afterLedger.cashierBalance)} ` +
          "is still in cashier custody. Reverse/reconcile the appropriate cashier transfer first; " +
          "do not change original receipts or allocations. No transaction was changed."
        );
      }
      if (worsenedFunds.length) {
        throw new Error(
          `Cannot void OR ${baseOR}: it would create/worsen a negative source fund (` +
          `${worsenedFundNames}). Reverse or correct the underlying allocation/expense ` +
          "through an audited transaction before voiding this OR. No transaction was changed."
        );
      }
      details = penaltyRestoration
        ? `Voided official receipt ${baseOR} and restored the outstanding fine for ${penaltyRestoration.ref}`
        : `Voided all ${receiptRows.length} allocation(s) of official receipt ${baseOR}; restored ${restoredCollectibles} linked collectible assessment(s)`;
    } else if (category === "penalties") {
      const record = await tx.penalty.findFirst({
        where: { organizationId: organization.id, penaltyId: referenceId },
      });
      if (!record) throw new Error("Penalty record not found.");
      if (isVoided(record.status)) throw new Error("Penalty is already voided.");
      if (/^(SETTLED|PARTIALLY PAID)/i.test(clean(record.status))) {
        throw new Error("This penalty has cash payment history. First void its linked OR(s) under Void Center → Official Payment Receipts, then void the penalty.");
      }
      await checkOpenTerm(record.academicYear, record.term);
      // Do not allow the second entry point to remove a fine while cash
      // receipts are active. This branch is intentionally receipt-first.
      const penaltyStudent = record.studentId ? await tx.student.findFirst({ where: {
        organizationId: organization.id,
        studentId: { equals: record.studentId, mode: "insensitive" },
      }, select: { id: true } }) : null;
      const activePenaltyReceipts = penaltyStudent ? await tx.collection.findMany({ where: {
        organizationId: organization.id,
        academicYear: record.academicYear,
        term: record.term,
        studentId: penaltyStudent.id,
        OR: [
          { itemDescription: { startsWith: `Penalty Fine [${record.penaltyId}]:` } },
          { itemDescription: { equals: `Penalty Fine: ${record.activity}`, mode: "insensitive" } },
        ],
      }, select: { status: true, paymentType: true } }) : [];
      if (activePenaltyReceipts.some(row => !isVoided(row.status) && !isVoided(row.paymentType))) {
        throw new Error("A penalty receipt is still active. Void its OR first in the Official Payment Receipts category.");
      }
      affectedRecordIds = [record.id];
      ay = record.academicYear;
      term = record.term;
      amount = money(record.fineAmount);
      await tx.penalty.update({
        where: { id: record.id },
        data: { status: `Voided: ${reason}` },
      });
      details = `Voided penalty ${referenceId}`;
    } else if (category === "liquidations") {
      const audit = await tx.audit.findFirst({ where: {
        organizationId: organization.id, auditId: referenceId,
      } });
      if (!audit) throw new Error("Audited liquidation not found.");
      if (isVoided(audit.status)) throw new Error("Liquidation is already voided.");
      if (clean(audit.status).toUpperCase() !== "AUDITED & VERIFIED") {
        throw new Error("Only verified liquidations may be reversed.");
      }
      const before = await checkOpenTerm(audit.academicYear, audit.term);
      await assertAcademicPeriod(tx, organization.id, audit.academicYear, audit.term);
      const linkedCa = clean(audit.referenceCaId);
      const hasCa = linkedCa !== "" && linkedCa !== "Direct Expense (No CA)";
      let advance: Awaited<ReturnType<typeof tx.cashAdvance.findFirst>> = null;
      if (hasCa) {
        advance = await tx.cashAdvance.findFirst({ where: {
          organizationId: organization.id, advanceId: linkedCa,
          academicYear: audit.academicYear, term: audit.term,
        } });
        if (!advance || clean(advance.status).toUpperCase() !== "LIQUIDATED") {
          throw new Error("Associated cash advance is not liquidated; manual reconciliation required.");
        }
        if (advance.fundSource !== audit.fundSource ||
            Math.round(Number(advance.amountApproved) * 100) !== Math.round(Number(audit.budgetRequested) * 100)) {
          throw new Error("Cash advance and liquidation source/budget disagree. Reconciliation required.");
        }
      }
      const marked = await tx.audit.updateMany({ where: {
        id: audit.id, organizationId: organization.id, status: audit.status,
      }, data: { status: `Voided: ${reason}` } });
      if (marked.count !== 1) throw new Error("Liquidation changed concurrently; no reversal posted.");
      if (advance) {
        const reopened = await tx.cashAdvance.updateMany({ where: {
          id: advance.id, organizationId: organization.id, status: "Liquidated",
        }, data: { status: "Pending Liquidation" } });
        if (reopened.count !== 1) throw new Error("Cash advance changed concurrently; no reversal posted.");
      }
      const after = await getPeriodLedger(tx, organization.id, audit.academicYear, audit.term);
      const beforeFunds = new Map(before.funds.map(f => [f.name, Math.round(f.balance * 100)]));
      const worsening = after.funds.filter(f => {
        const newCents = Math.round(f.balance * 100);
        return newCents < 0 && newCents < (beforeFunds.get(f.name) ?? 0);
      });
      if (after.totalRemaining < -0.005 || worsening.length ||
          after.cashierBalance < -0.005 || after.cashierBalance > after.totalRemaining + 0.005) {
        throw new Error("Reversing this liquidation would over-reserve a fund or conflict with cashier custody. Reconcile the available funds before voiding. No records were changed.");
      }
      affectedRecordIds = [audit.id];
      if (advance) affectedRecordIds.push(advance.id);
      ay = audit.academicYear;
      term = audit.term;
      amount = money(audit.totalExpense);
      details = `Voided audited liquidation ${audit.auditId}; original expense items retained; ` +
        (advance ? `reopened CA ${advance.advanceId}` : "direct expense restored to its original fund") +
        `; source fund ${audit.fundSource}`;
      await tx.systemLog.create({ data: {
        organizationId: organization.id, user: officerName, action: "REVERSE_AUDITED_LIQUIDATION",
        details: `${details}; balance ${before.totalRemaining.toFixed(2)} → ${after.totalRemaining.toFixed(2)}; reason: ${reason}`,
      } });
    } else if (category === "advances") {
      const record = await tx.cashAdvance.findFirst({
        where: { organizationId: organization.id, advanceId: referenceId },
      });
      if (!record) throw new Error("Cash advance record not found.");
      if (isVoided(record.status)) throw new Error("Advance is already voided or cancelled.");
      if (/LIQUIDATED/i.test(record.status) && !/UNLIQUIDATED/i.test(record.status)) {
        throw new Error("An already-liquidated advance cannot be cancelled here.");
      }
      await checkOpenTerm(record.academicYear, record.term);
      const activeAudit = await tx.audit.findFirst({ where: {
        organizationId: organization.id, referenceCaId: referenceId,
        NOT: { OR: [
          { status: { contains: "VOID", mode: "insensitive" } },
          { status: { contains: "CANCEL", mode: "insensitive" } },
        ] },
      }, select: { id: true } });
      if (activeAudit) {
        throw new Error("An active liquidation exists for this advance. Reverse its audit first.");
      }
      affectedRecordIds = [record.id];
      ay = record.academicYear;
      term = record.term;
      amount = money(record.amountApproved);
      await tx.cashAdvance.update({
        where: { id: record.id },
        data: { status: `Cancelled: ${reason}` },
      });
      details = `Cancelled cash advance ${referenceId}`;
    } else if (category === "collectibles") {
      const record = await tx.collectible.findFirst({
        where: { organizationId: organization.id, id: referenceId },
      });
      if (!record) throw new Error("Collectible assessment not found.");
      await checkOpenTerm(record.academicYear, record.term);
      await assertAcademicPeriod(tx, organization.id, record.academicYear, record.term);
      const outcome = await voidStudentCollectibleAssessment(tx, {
        organizationId: organization.id, collectibleId: record.id, reason,
      });
      affectedRecordIds = [outcome.id];
      ay = outcome.ay;
      term = outcome.term;
      amount = outcome.amount;
      details = outcome.details;
    }

    // The uploaded schema.prisma defines only these insertable fields:
    // organizationId, transactionType, referenceId, amount, reason, voidedBy.
    // The original DB record IDs are preserved in SystemLog.details instead.
    await tx.voidTransaction.create({
      data: {
        organizationId: organization.id,
        transactionType: category.toUpperCase(),
        referenceId: voidReference,
        amount,
        reason,
        voidedBy: officerName,
      },
    });

    await tx.systemLog.create({
      data: {
        organizationId: organization.id,
        user: officerName,
        action: "VOID_TRANSACTION",
        details: `${details} (${ay}, ${term}); ₱${amount.toFixed(2)}; IDs: ${affectedRecordIds.join(", ")}. Reason: ${reason}`,
      },
    });
    return { referenceId: voidReference, count: affectedRecordIds.length, amount };
  });

  const root = `/department/${encodeURIComponent(department)}`;
  for (const route of [
    "", "/void", "/logs", "/summary", "/reports", "/realign",
    "/advances", "/clearance", "/collections", "/cashier-remittance",
    "/collectibles", "/remittances", "/liquidations",
  ]) {
    revalidatePath(root + route);
  }
  return {
    success: true,
    message: `Successfully voided ${result.referenceId} (${result.count} record(s), ₱${result.amount.toFixed(2)}).`,
  };
}
