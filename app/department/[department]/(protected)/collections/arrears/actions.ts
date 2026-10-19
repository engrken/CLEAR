"use server";
import { isValidClearAccountingDate, parseClearAccountingDate } from "@/lib/clear-timezone";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { listHistoricalDebts } from "@/lib/student-arrears";
import { assertAcademicPeriod } from "@/lib/academic-period-guard";
import { getPeriodLedger, toCents } from "../../realign/ledger";
import { ensurePenaltyFund } from "@/lib/penalty-fund.server";
import { PENALTY_FUND_NAME } from "@/lib/penalty-fund";
import { enqueuePaymentReceipt, scheduleDigitalReceiptDispatch } from "@/lib/digital-receipts";

export type ArrearPaymentRequest = {
  studentId: string; obligationType: "penalty" | "collectible"; obligationId: string;
  amount: number; orNumber: string; paymentDate: string; ay: string; term: string;
};
const cents = (x: unknown) => {
  const n = Number(x);
  if (!Number.isFinite(n) || n <= 0 || n * 100 > Number.MAX_SAFE_INTEGER ||
      Math.abs(n * 100 - Math.round(n * 100)) > 0.000001) throw new Error("Amount must be a positive centavo-exact value.");
  return Math.round(n * 100);
};

export async function recordHistoricalArrearPayment(department: string, data: ArrearPaymentRequest) {
  const dep = decodeURIComponent(department).trim().toLowerCase();
  const user = await requireTabAccess("tab-payment", dep);
  const actor = String(user.fullName || user.name || user.email || "Officer");
  const org = await prisma.organization.findUnique({ where: { subdomain: dep },
    select: { id: true, activeAy: true, activeTerm: true } });
  if (!org) throw new Error("Tenant not found.");
  if (data.ay !== org.activeAy || data.term !== org.activeTerm) {
    throw new Error("Historical arrears must be receipted in the organization's currently open period.");
  }
  const orNumber = String(data.orNumber || "").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,50}$/.test(orNumber)) throw new Error("Enter a valid new official receipt number.");
  const amountCents = cents(data.amount);
  const dt = String(data.paymentDate || "");
  if (!isValidClearAccountingDate(dt)) {
    throw new Error("Enter a valid payment date.");
  }
  if (data.obligationType !== "penalty" && data.obligationType !== "collectible") throw new Error("Invalid obligation type.");
  let result: { remaining: number; receipt: string } | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      result = await prisma.$transaction(async tx => {
        await assertAcademicPeriod(tx, org.id, data.ay, data.term);
        const ledger = await getPeriodLedger(tx, org.id, data.ay, data.term);
        if (ledger.activeRollover) throw new Error("Current period is closed.");
        const student = await tx.student.findFirst({ where: { organizationId: org.id,
          studentId: { equals: data.studentId, mode: "insensitive" } } });
        if (!student) throw new Error("Student not found in this tenant.");
        // Only verified, preceding-period assessment IDs may be paid.
        const candidates = await listHistoricalDebts(tx, org.id, data.ay, data.term, student.studentId);
        const due = candidates.find(x => x.obligationType === data.obligationType && x.obligationId === data.obligationId);
        if (!due) throw new Error("No such outstanding historical obligation for this student.");
        const dueCents = cents(due.balanceDue);
        if (amountCents > dueCents) throw new Error("Payment exceeds the unpaid historical balance.");
        const duplicate = await tx.collection.findFirst({ where: { organizationId: org.id,
          OR: [{ orNumber }, { orNumber: { startsWith: `${orNumber}-P` } }] }, select: { id: true } });
        if (duplicate) throw new Error("Official receipt number already exists.");
        let fund = "";
        let oldPenaltyBalance: number | null = null;
        let linkedPenaltyRecordId: string | null = null;
        if (data.obligationType === "penalty") {
          const penalty = await tx.penalty.findFirst({ where: { id: due.obligationId,
            organizationId: org.id, studentId: student.studentId } });
          if (!penalty || /VOID|CANCEL|^SETTLED/i.test(penalty.status)) throw new Error("Penalty is no longer payable.");
          oldPenaltyBalance = dueCents / 100;
          linkedPenaltyRecordId = penalty.id;
          const updated = await tx.penalty.updateMany({ where: {
            id: penalty.id, organizationId: org.id, fineAmount: penalty.fineAmount,
            status: penalty.status,
          }, data: { fineAmount: (dueCents - amountCents) / 100,
            status: amountCents === dueCents ? "Settled (Historical Cash)" : "Partially Paid (Historical Cash)" } });
          if (updated.count !== 1) throw new Error("Penalty changed while posting.");
          await ensurePenaltyFund(tx, org.id, data.ay, data.term);
          fund = PENALTY_FUND_NAME;
        } else {
          const collectible = await tx.collectible.findFirst({ where: { id: due.obligationId, organizationId: org.id } });
          if (!collectible) throw new Error("Collectible missing.");
          const matchingFees = await tx.collectionSetup.findMany({ where: { organizationId: org.id,
            academicYear: due.originAY, term: due.originTerm, category: due.category,
            name: due.itemDescription, isPackage: false } });
          if (matchingFees.length !== 1 || !String(matchingFees[0].targetFund || "").trim()) {
            throw new Error("Original assessment fee/fund is missing or ambiguous. Accounting reconciliation required.");
          }
          fund = matchingFees[0].targetFund;
          const target = await tx.fund.findFirst({ where: { organizationId: org.id,
            academicYear: data.ay, term: data.term, fundName: fund } });
          if (!target) throw new Error(`Set up the destination pool ${fund} for the new term before receiving arrears.`);
          const updated = await tx.collectible.updateMany({ where: { id: collectible.id, organizationId: org.id,
            balanceDue: collectible.balanceDue, status: collectible.status },
            data: { balanceDue: (dueCents - amountCents) / 100,
              status: amountCents === dueCents ? String(collectible.status).replace(/^Unpaid|^Outstanding/i, "Paid") : collectible.status } });
          if (updated.count !== 1) throw new Error("Collectible changed while posting.");
        }
        const receipt = await tx.collection.create({ data: { organizationId: org.id,
          academicYear: data.ay, term: data.term, date: parseClearAccountingDate(dt),
          studentId: student.id, studentName: student.fullName,
          orNumber, category: due.category,
          itemDescription: `Historical ${due.obligationType === "penalty" ? "Penalty" : "Collectible"} [${due.obligationId}]: ${due.itemDescription} (${due.originTerm}, ${due.originAY})`,
          paymentType: amountCents === dueCents ? "Full Payment" : "Partial Payment",
          standardRate: dueCents / 100, amountPaid: amountCents / 100,
          balanceDue: (dueCents - amountCents) / 100,
          fundAllocation: fund, status: "Valid", encodedBy: actor,
        } });
        await tx.arrearPaymentLink.create({ data: { organizationId: org.id,
          receiptId: receipt.id, obligationType: due.obligationType, obligationId: due.obligationId,
          originAY: due.originAY, originTerm: due.originTerm, amount: amountCents / 100 } });
        if (linkedPenaltyRecordId && oldPenaltyBalance !== null) {
          await tx.penaltySettlementEvent.create({ data: {
            organizationId: org.id, penaltyRecordId: linkedPenaltyRecordId,
            receiptId: receipt.id, method: "CASH_PAYMENT", amount: amountCents / 100,
            accountingAY: data.ay, accountingTerm: data.term,
            balanceBefore: oldPenaltyBalance, balanceAfter: oldPenaltyBalance - amountCents / 100,
            recordedBy: actor, note: `Historical penalty paid via current-period OR ${orNumber}`,
          } });
        }
        await tx.systemLog.create({ data: { organizationId: org.id, user: actor,
          action: "RECEIVE_HISTORICAL_ARREAR", details: `OR ${orNumber}; student ${student.studentId}; historical ${due.obligationType} ${due.obligationId} from ${due.originTerm} (${due.originAY}); amount ₱${(amountCents / 100).toFixed(2)} allocated to ${fund}; new ${data.term} (${data.ay}); remaining ₱${((dueCents - amountCents) / 100).toFixed(2)}.` } });
        await enqueuePaymentReceipt(tx, { organizationId: org.id, orNumber, officerName: actor, officerEmail: String(user.email || ""), source: "HISTORICAL_ARREAR" });
        return { receipt: orNumber, remaining: (dueCents - amountCents) / 100 };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
      break;
    } catch (e: any) { if (e?.code === "P2034" && attempt < 2) continue; throw e; }
  }
  if (!result) throw new Error("Could not post arrear payment.");
  for (const part of ["collections", "collections/arrears", "clearance", "penalties", "collectibles", "realign", "summary", "reports"]) {
    revalidatePath(`/department/${dep}/${part}`);
  }
  scheduleDigitalReceiptDispatch(org.id, `payment:${orNumber}`);
  return { success: true, ...result };
}
