"use server";
import { parseClearAccountingDate } from '@/lib/clear-timezone';

import { Prisma } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { getCashierPosition, getPeriodLedger, toCents, fromCents } from "../realign/ledger";
import { assertAcademicPeriod } from "@/lib/academic-period-guard";
import { enqueueAccountingNotice, scheduleDigitalReceiptDispatch } from "@/lib/digital-receipts";

const GENERAL_CASH_POOL = "Remaining Balance (Net Ending Position)";
const clean = (value: unknown): string => String(value ?? "").trim();

function actorName(user: any): string {
  return clean(user?.fullName || user?.name || user?.email) || "Authorized Officer";
}

function parseDate(value: unknown): Date {
  try { return parseClearAccountingDate(clean(value)); }
  catch { throw new Error("Invalid transaction date. Use YYYY-MM-DD."); }
}

function refresh(department: string): void {
  const base = `/department/${department}`;
  for (const route of ["", "/cashier-remittance", "/summary", "/reports", "/realign", "/setup"]) {
    revalidatePath(base + route);
  }
}

async function authorize(department: string, tab: string) {
  const normalized = clean(department).toLowerCase();
  if (!normalized) throw new Error("Department is required.");
  const officer = await requireTabAccess(tab, normalized);
  const organization = await prisma.organization.findUnique({
    where: { subdomain: normalized },
    select: { id: true },
  });
  if (!organization) throw new Error("Department not found.");
  return { normalized, orgId: organization.id, officer: actorName(officer), officerEmail: String((officer as any).email || "") };
}

async function transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 20000,
      });
    } catch (error: any) {
      if (error?.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("Transaction conflict. Please retry.");
}

export async function recordCashierRemittance(
  department: string,
  data: {
    date: string;
    remittedBy: string;
    fundSource: string;
    type: string;
    amount: number;
    cashierReceiptNo: string;
    remarks: string;
    ay: string;
    term: string;
  }
) {
  const { normalized, orgId, officer, officerEmail } = await authorize(department, "tab-payment");
  const ay = clean(data.ay);
  const term = clean(data.term);
  const fundSource = clean(data.fundSource);
  const type = clean(data.type);
  const amountCents = toCents(data.amount);
  const remittedBy = clean(data.remittedBy);
  const date = parseDate(data.date);
  const remarks = clean(data.remarks);
  const cashierReceiptNo = clean(data.cashierReceiptNo) || "PENDING";

  if (!ay || !term || !fundSource) throw new Error("Accounting term and source fund are required.");
  if (type !== "Deposit" && type !== "Withdrawal") throw new Error("Invalid cashier transaction type.");
  if (amountCents <= 0 || Math.abs(Number(data.amount) * 100 - amountCents) > 0.000001) {
    throw new Error("Use a positive amount with no more than two decimal places.");
  }
  if (!remittedBy) throw new Error("Name of officer/requestor is required.");
  if (remarks.length > 500) throw new Error("Remarks are too long (maximum 500 characters).");

  const result = await transaction(async tx => {
    await assertAcademicPeriod(tx, orgId, ay, term);
    const ledger = await getPeriodLedger(tx, orgId, ay, term);
    if (ledger.activeRollover) {
      throw new Error("This term has been carried over. Reverse the rollover before recording new cashier transactions.");
    }
    const cashier = await getCashierPosition(tx, orgId, ay, term);
    const totalHeldCents = toCents(cashier.cashierBalance);
    const totalPhysicalCents = toCents(ledger.totalRemaining) - totalHeldCents;
    const selectedPool = ledger.funds.find(f => f.name === fundSource);
    const selectedHeldCents = toCents(cashier.balancesByFund[fundSource] ?? 0);

    if (type === "Deposit") {
      // The net ending position is an aggregate, NOT an actual fund. New
      // safekeeping deposits must be attributable to a tenant's real fund.
      // Existing historical pooled transactions stay untouched/auditable.
      if (fundSource === GENERAL_CASH_POOL) {
        throw new Error("Choose an actual source fund (e.g., General Fund or Penalty Fund). Net Ending Position is an aggregate balance, not a fund. Historical pooled records remain available for withdrawal/reconciliation.");
      }
      if (!selectedPool) {
        throw new Error("Selected source fund does not exist in this department and accounting term.");
      }
      if (amountCents > totalPhysicalCents) {
        throw new Error(`Insufficient physical cash. Available: ₱${fromCents(totalPhysicalCents).toFixed(2)}.`);
      }
      if (amountCents > toCents(selectedPool.balance) - selectedHeldCents) {
        throw new Error(`Insufficient physical cash attributed to ${fundSource} for this deposit.`);
      }
    } else {
      // Old aggregate deposits may be withdrawn to unwind legacy custody;
      // no NEW aggregate deposits are allowed. Reject other unknown pools.
      if (!selectedPool && fundSource !== GENERAL_CASH_POOL) {
        throw new Error("Selected source fund does not exist in this department and accounting term.");
      }
      if (amountCents > totalHeldCents || amountCents > selectedHeldCents) {
        throw new Error(`Insufficient deposited funds in ${fundSource}. Held: ₱${fromCents(selectedHeldCents).toFixed(2)}.`);
      }
    }

    const remittanceId = `${type === "Withdrawal" ? "WITH" : "SAFE"}-${randomBytes(4).toString("hex").toUpperCase()}`;
    await tx.cashierRemittance.create({
      data: {
        organizationId: orgId,
        remittanceId,
        academicYear: ay,
        term,
        date,
        remittedBy,
        fundSource,
        type,
        amount: fromCents(amountCents),
        cashierReceiptNo,
        remarks,
        status: "Remitted",
        encodedBy: officer,
      },
    });
    await tx.systemLog.create({
      data: {
        organizationId: orgId,
        user: officer,
        action: `RECORD_CASHIER_${type.toUpperCase()}`,
        details: `${ay} ${term}: ${type} ₱${fromCents(amountCents).toFixed(2)} (${fundSource}), receipt ${remittanceId}.`,
      },
    });
    const requestorCandidates = await tx.tenantUser.findMany({ where: { organizationId: orgId,
      fullName: { equals: remittedBy, mode: "insensitive" } }, select: { email: true }, take: 2 });
    await enqueueAccountingNotice(tx, {
      organizationId: orgId, eventKey: `cashier:${remittanceId}`,
      documentType: `Cashier ${type} Acknowledgment`, referenceNo: remittanceId,
      academicYear: ay, term, amount: fromCents(amountCents), officerName: officer,
      officerEmail,
      participantName: remittedBy, participantEmail: requestorCandidates.length === 1 ? requestorCandidates[0].email : null,
      participantRole: "Remitting Officer / Requestor",
      details: [{label:"Fund",value:fundSource}, {label:"Cashier reference", value: cashierReceiptNo}],
    });
    return { success: true, remittanceId };
  });
  scheduleDigitalReceiptDispatch(orgId, `cashier:${result.remittanceId}`);
  refresh(normalized);
  return result;
}

export async function voidCashierRemittance(department: string, id: string) {
  const { normalized, orgId, officer } = await authorize(department, "tab-void");
  const recordId = clean(id);
  if (!recordId) throw new Error("Record ID is missing.");

  const result = await transaction(async tx => {
    const existing = await tx.cashierRemittance.findFirst({
      where: { organizationId: orgId, id: recordId },
    });
    if (!existing) throw new Error("Cashier transaction not found.");
    if (clean(existing.status).toUpperCase() !== "REMITTED") throw new Error("This cashier transaction was already voided.");

    const ledger = await getPeriodLedger(tx, orgId, existing.academicYear, existing.term);
    if (ledger.activeRollover) {
      throw new Error("This term has been carried over. Reverse the rollover before voiding a cashier record.");
    }
    const custody = await getCashierPosition(tx, orgId, existing.academicYear, existing.term);
    const cents = toCents(existing.amount);
    const fundName = clean(existing.fundSource) || GENERAL_CASH_POOL;
    const oldHeld = toCents(custody.cashierBalance);
    const oldFundHeld = toCents(custody.balancesByFund[fundName] || 0);
    const newHeld = oldHeld + (existing.type === "Deposit" ? -cents : cents);
    const newFundHeld = oldFundHeld + (existing.type === "Deposit" ? -cents : cents);
    const poolBalance = ledger.funds.find(f => f.name === fundName)?.balance;

    if (newHeld < 0 || newFundHeld < 0) {
      throw new Error("Cannot void: the associated deposited amount has already been withdrawn. Reverse those withdrawals first.");
    }
    if (newHeld > toCents(ledger.totalRemaining)) {
      throw new Error("Cannot void this withdrawal: the resulting physical cash balance would be negative.");
    }
    if (poolBalance !== undefined && newFundHeld > toCents(poolBalance)) {
      throw new Error("Cannot void this withdrawal: the selected fund no longer supports that cashier balance.");
    }

    await tx.cashierRemittance.update({ where: { id: existing.id }, data: { status: "Voided" } });
    await tx.systemLog.create({
      data: {
        organizationId: orgId,
        user: officer,
        action: "VOID_CASHIER_TRANSACTION",
        details: `Voided ${existing.remittanceId} (${existing.type} ₱${Number(existing.amount).toFixed(2)}) for ${fundName}.`,
      },
    });
    return { success: true };
  });
  refresh(normalized);
  return result;
}
