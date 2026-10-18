"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import {
  CARRIED_GENERAL_FUND,
  embedRolloverMetadata,
  getNextPeriod,
  getPeriodLedger,
  sourceLabel,
  toCents,
  fromCents,
  type RolloverMetadata,
} from "./ledger";
import { followingAcademicYear, isValidPeriod, configurationForYear, type CalendarByYear } from "@/lib/academic-periods";

type TransferRequest = {
  fromFund: string;
  toFund: string;
  amount: number;
  reason: string;
  ay: string;
  term: string;
};

type CarryRequest = {
  sourceAY: string;
  sourceTerm: string;
  destAY?: string;
  destTerm?: string;
  amount?: number; // backwards-compatible: actual amount is ALWAYS calculated on server
  reason: string;
  feePolicy?: "retain" | "manual";
  expectedSourceFeeCount?: number;
};

function textValue(value: unknown): string {
  return String(value ?? "").trim();
}

async function authorize(department: string) {
  const cleanDepartment = textValue(department).toLowerCase();
  if (!cleanDepartment) throw new Error("Department is required.");
  const officer = await requireTabAccess("tab-transfer", cleanDepartment);
  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
    select: { id: true },
  });
  if (!organization) throw new Error("Department not found.");
  const actor = String((officer as any).fullName || officer.name || officer.email || "Authorized Officer");
  return { cleanDepartment, orgId: organization.id, actor };
}

function revalidateModule(department: string) {
  const root = `/department/${department}`;
  for (const page of ["", "/realign", "/advances", "/liquidations", "/reports", "/summary", "/setup", "/setup/collections", "/collections", "/collectibles", "/cashier-remittance"]) {
    revalidatePath(`${root}${page}`);
  }
}

/** Retry only serialization conflicts, never authorization/balance failures. */
async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 20000,
        maxWait: 10000,
      });
    } catch (error: any) {
      if (error?.code === "P2034" && attempt < 2) continue;
      throw error;
    }
  }
  throw new Error("Unable to complete transaction. Please retry.");
}

export async function transferFunds(department: string, data: TransferRequest) {
  const { cleanDepartment, orgId, actor } = await authorize(department);
  const fromFund = textValue(data.fromFund);
  const toFund = textValue(data.toFund);
  const reason = textValue(data.reason);
  const ay = textValue(data.ay);
  const term = textValue(data.term);
  const cents = toCents(data.amount);

  if (!fromFund || !toFund) throw new Error("Choose a source and destination fund.");
  if (fromFund === toFund) throw new Error("Source and destination funds must differ.");
  if (!ay || !term) throw new Error("Accounting period is missing.");
  if (cents <= 0) throw new Error("Transfer amount must be greater than ₱0.00.");
  if (Math.abs(Number(data.amount) * 100 - cents) > 0.000001) {
    throw new Error("Transfer amounts cannot contain fractions of a centavo.");
  }
  if (!reason) throw new Error("A transfer reason is required.");
  if (reason.length > 500) throw new Error("Please limit the reason to 500 characters.");

  const record = await serializable(async tx => {
    const ledger = await getPeriodLedger(tx, orgId, ay, term);
    if (ledger.activeRollover) {
      throw new Error("This term has already been carried over. Reverse the rollover in Setup before posting new fund realignments.");
    }
    const source = ledger.funds.find(f => f.name === fromFund);
    const destination = ledger.funds.find(f => f.name === toFund);
    if (!source || !destination) {
      throw new Error("One of the selected fund pools no longer exists. Refresh and try again.");
    }
    if (toCents(source.balance) < cents) {
      throw new Error(`Insufficient funds in ${fromFund}. Available: ₱${source.balance.toFixed(2)}.`);
    }
    const transfer = await tx.fundTransfer.create({
      data: {
        organizationId: orgId,
        academicYear: ay,
        term,
        sourceFund: fromFund,
        destinationFund: toFund,
        amount: fromCents(cents),
        reason,
        encodedBy: actor,
      },
    });
    await tx.systemLog.create({
      data: {
        organizationId: orgId,
        user: actor,
        action: "TRANSFER_FUNDS",
        details: `${ay} ${term}: ₱${fromCents(cents).toFixed(2)} moved from ${fromFund} to ${toFund}. Ref ${transfer.id}. Reason: ${reason}`,
      },
    });
    return { id: transfer?.id || "ZERO-BALANCE", amount: fromCents(cents) };
  });

  revalidateModule(cleanDepartment);
  return { success: true, ...record };
}

/**
 * Moves the ENTIRE verified available source-term balance to the next period.
 * The DB retains ONE destination-period rollover transfer. Its reason contains
 * an allocation snapshot, so the source period is debited without ghost funds.
 * setup/reverseRollover works as before: a ROLLOVER_REVERSAL void on the
 * transfer ID removes BOTH the outbound and inbound effect.
 */
export async function carryOverTermBalance(department: string, data: CarryRequest) {
  const { cleanDepartment, orgId, actor } = await authorize(department);
  const sourceAY = textValue(data.sourceAY);
  const sourceTerm = textValue(data.sourceTerm);
  const reason = textValue(data.reason);
  if (!sourceAY || !sourceTerm) throw new Error("Select a source accounting period.");
  if (!reason) throw new Error("A carry-over justification is required.");
  if (reason.length > 500) throw new Error("Please limit the reason to 500 characters.");

  if (data.feePolicy !== "manual" && data.feePolicy !== "retain") {
    throw new Error("Choose whether next-period fees will be retained or configured manually.");
  }
  const record = await serializable(async tx => {
    // All calendar and finance decisions are computed from the same transaction snapshot.
    const upcomingAy = followingAcademicYear(sourceAY);
    const rows = await tx.academicPeriodConfig.findMany({
      where: { organizationId: orgId, academicYear: { in: [sourceAY, upcomingAy] } },
      select: { academicYear: true, mode: true, includeSummer: true },
    });
    const calendars: CalendarByYear = Object.fromEntries(rows.map(row => [row.academicYear, {
      mode: row.mode as "Semester" | "Trimester" | "FullYear", includeSummer: row.includeSummer,
    }]));
    if (!isValidPeriod(sourceAY, sourceTerm, configurationForYear(sourceAY, calendars))) {
      throw new Error("Invalid source term for this organization's academic calendar.");
    }
    const next = getNextPeriod(sourceAY, sourceTerm, calendars);
    if (data.destAY && textValue(data.destAY) !== next.ay) throw new Error("Carry-over destination period has changed. Refresh and preview again.");
    if (data.destTerm && textValue(data.destTerm) !== next.term) throw new Error("Carry-over destination period has changed. Refresh and preview again.");
    const orgState = await tx.organization.findUnique({ where: { id: orgId },
      select: { activeAy: true, activeTerm: true } });
    if (!orgState || orgState.activeAy !== sourceAY || orgState.activeTerm !== sourceTerm) {
      throw new Error("Only the organization's currently active period can be closed. Change periods through the controlled transition workflow.");
    }
    const existingClosure = await tx.academicPeriodTransition.findUnique({
      where: { organizationId_sourceAY_sourceTerm: { organizationId: orgId, sourceAY, sourceTerm } },
    });
    if (existingClosure && existingClosure.status !== "Reopened") {
      throw new Error("This source period already has an active closure. An authorized reversal is required before repeating a transition.");
    }
    const ledger = await getPeriodLedger(tx, orgId, sourceAY, sourceTerm);
    const destinationLedger = await getPeriodLedger(tx, orgId, next.ay, next.term);
    if (destinationLedger.activeRollover || toCents(destinationLedger.totalRemaining) !== 0) {
      throw new Error("The destination period already contains an opening balance or closed rollover. Reconcile its funds before activating it.");
    }
    const [pendingRemittances, destinationCollections, destinationPenalties,
      destinationDues, destinationAdvances, destinationAudits, destinationCashier] = await Promise.all([
        tx.onlineRemittance.count({ where: { organizationId: orgId, academicYear: sourceAY,
          term: sourceTerm, status: { contains: "Pending", mode: "insensitive" } } }),
        tx.collection.count({ where: { organizationId: orgId, academicYear: next.ay, term: next.term } }),
        tx.penalty.count({ where: { organizationId: orgId, academicYear: next.ay, term: next.term } }),
        tx.collectible.count({ where: { organizationId: orgId, academicYear: next.ay, term: next.term } }),
        tx.cashAdvance.count({ where: { organizationId: orgId, academicYear: next.ay, term: next.term } }),
        tx.audit.count({ where: { organizationId: orgId, academicYear: next.ay, term: next.term } }),
        tx.cashierRemittance.count({ where: { organizationId: orgId, academicYear: next.ay, term: next.term } }),
      ]);
    if (pendingRemittances) throw new Error("Verify or reject pending student remittances before closing the term.");
    if ([destinationCollections,destinationPenalties,destinationDues,destinationAdvances,
      destinationAudits,destinationCashier].some(n => n > 0)) {
      throw new Error("The destination period already has transactions. An accounting administrator must reconcile it before opening a new period.");
    }
    if (ledger.activeRollover) {
      const prev = ledger.activeRollover;
      throw new Error(`This source term was already carried over to ${prev.destinationTerm} (${prev.destinationAY}). Reverse that rollover from Setup before trying again.`);
    }
    if (ledger.unliquidated > 0) {
      throw new Error(`Resolve pending/unliquidated cash advances (₱${ledger.unliquidated.toFixed(2)}) before closing the term.`);
    }
    if (Math.abs(ledger.cashierBalance) > 0.005) {
      throw new Error(`University Cashier still holds ₱${ledger.cashierBalance.toFixed(2)} from this term. Settle safekeeping custody before carry-over.`);
    }
    if (ledger.hasNegativeFunds) {
      const names = ledger.negativeFunds.map(f => `${f.name} (₱${f.balance.toFixed(2)})`).join(", ");
      throw new Error(`Resolve negative fund balances before closing this term: ${names}. You can realign available funds first.`);
    }
    const splits = ledger.funds
      .map(f => ({ name: f.name, cents: toCents(f.balance) }))
      .filter(f => f.cents > 0);
    const total = splits.reduce((sum, split) => sum + split.cents, 0);
    if (!Number.isSafeInteger(total) || total < 0) {
      throw new Error("Closing requires a nonnegative available balance.");
    }
    if (data.amount !== undefined && toCents(data.amount) !== total) {
      throw new Error("Available balance changed. Refresh and preview the carry-over again.");
    }
    // Use the existing next-term General Fund; create a zero-opening account
    // only when missing. Do NOT make a second "Carried Over" pool.
    await tx.fund.upsert({
      where: { organizationId_academicYear_term_fundName: {
        organizationId: orgId, academicYear: next.ay, term: next.term,
        fundName: CARRIED_GENERAL_FUND,
      } },
      create: { organizationId: orgId, academicYear: next.ay, term: next.term,
        fundName: CARRIED_GENERAL_FUND, initialAllocation: 0, currentBalance: 0 },
      update: {},
    });
    const existingDestinationFees = await tx.collectionSetup.count({
      where: { organizationId: orgId, academicYear: next.ay, term: next.term },
    });
    let copiedFeeCount = 0;
    const copiedFeeSnapshot: NonNullable<RolloverMetadata["copiedFeeSnapshot"]> = [];
    if (data.feePolicy === "retain") {
      if (existingDestinationFees !== 0) {
        throw new Error("Destination period already has configured fees. Do not overwrite them; select manual setup instead, or clear unused fees with authorization before rollover.");
      }
      const sourceFees = await tx.collectionSetup.findMany({
        where: { organizationId: orgId, academicYear: sourceAY, term: sourceTerm },
      });
      if (data.expectedSourceFeeCount !== sourceFees.length) {
        throw new Error("Source fee setup changed after preview. Refresh the page and retry.");
      }
      if (sourceFees.length === 0) throw new Error("No source-period fee items exist to retain. Select manual fee setup.");
      // Each newly carried fee must point to a real zero-opening fund pool.
      for (const fundName of new Set(sourceFees.map(f => f.targetFund))) {
        await tx.fund.upsert({
          where: { organizationId_academicYear_term_fundName: {
            organizationId: orgId, academicYear: next.ay, term: next.term, fundName,
          } },
          create: { organizationId: orgId, academicYear: next.ay, term: next.term,
            fundName, initialAllocation: 0, currentBalance: 0 },
          update: {},
        });
      }
      for (const sourceFee of sourceFees) {
        const copied = await tx.collectionSetup.create({ data: {
          organizationId: orgId, academicYear: next.ay, term: next.term,
          category: sourceFee.category, name: sourceFee.name, amount: sourceFee.amount,
          targetFund: sourceFee.targetFund, isPackage: sourceFee.isPackage,
        }});
        copiedFeeSnapshot.push({ id: copied.id, category: copied.category, name: copied.name,
          amount: copied.amount, targetFund: copied.targetFund, isPackage: copied.isPackage });
      }
      copiedFeeCount = sourceFees.length;
    }
    const metadata: RolloverMetadata = { version: 2, sourceAY, sourceTerm, splits,
      copiedFeeIds: copiedFeeSnapshot.map(row => row.id), copiedFeeSnapshot };
    const transfer = total > 0 ? await tx.fundTransfer.create({
      data: {
        organizationId: orgId,
        academicYear: next.ay,
        term: next.term,
        sourceFund: sourceLabel(sourceAY, sourceTerm),
        destinationFund: CARRIED_GENERAL_FUND,
        amount: fromCents(total),
        reason: embedRolloverMetadata(reason, metadata),
        encodedBy: actor,
      },
    }) : null;
    const closureFields = { destinationAY: next.ay, destinationTerm: next.term,
      amount: fromCents(total), transferId: transfer?.id || null,
      feePolicy: data.feePolicy!, copiedFeesJson: JSON.stringify(copiedFeeSnapshot),
      reason, closedBy: actor, closedAt: new Date(), status: "Closed", reopenedAt: null };
    if (existingClosure) {
      await tx.academicPeriodTransition.update({ where: { id: existingClosure.id },
        data: closureFields });
    } else {
      await tx.academicPeriodTransition.create({ data: {
        organizationId: orgId, sourceAY, sourceTerm, ...closureFields,
      } });
    }
    // Atomically activate the new accounting period. All financial writers
    // must then use the new period, while the source is immutable.
    const activated = await tx.organization.updateMany({
      where: { id: orgId, activeAy: sourceAY, activeTerm: sourceTerm },
      data: { activeAy: next.ay, activeTerm: next.term },
    });
    if (activated.count !== 1) throw new Error("Active period changed concurrently. Closure was rolled back.");
    await tx.systemLog.create({
      data: {
        organizationId: orgId,
        user: actor,
        action: "CLOSE_AND_OPEN_PERIOD",
        details: `Ref ${transfer?.id || "ZERO-BALANCE"}: ₱${fromCents(total).toFixed(2)} carried from ${sourceTerm} (${sourceAY}) to ${next.term} (${next.ay}), General Fund. Fee policy: ${data.feePolicy}; ${copiedFeeCount} fee items copied. Sources: ${splits.map(f => `${f.name} ₱${fromCents(f.cents).toFixed(2)}`).join("; ")}. Reason: ${reason}`,
      },
    });
    return { id: transfer?.id || "ZERO-BALANCE", amount: fromCents(total), destinationAY: next.ay, destinationTerm: next.term, feePolicy: data.feePolicy, copiedFeeCount };
  });

  revalidateModule(cleanDepartment);
  return { success: true, ...record };
}
