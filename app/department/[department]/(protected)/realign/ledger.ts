/**
 * CLEAR realignment ledger (server-side utility, NOT a server-action file).
 * Uses the same base balance categories as the original realign/page.tsx,
 * with support for reversible, cross-term rollover debits.
 *
 * NOTE: Other modules with their own balance calculators must recognize
 * rollover metadata if they need to show source-period balances after rollover.
 */
import { moneyNumber } from "@/lib/money-precision";
import type { Prisma } from "@prisma/client";
import { followingPeriod, type CalendarByYear } from "@/lib/academic-periods";

// NEW rollovers credit the ordinary destination-period General Fund.
// Old historical transfers may still use "General Fund (Carried Over)";
// getPeriodLedger reads their stored destinationFund without rewriting them.
export const CARRIED_GENERAL_FUND = "General Fund";
const META_PREFIX = "[[CLEAR_ROLLOVER_V2:";
const MAX_CENTS = Number.MAX_SAFE_INTEGER;

type LedgerDb = Pick<
  Prisma.TransactionClient,
  "collection" | "audit" | "cashAdvance" | "fund" | "fundTransfer" | "voidTransaction" | "cashierRemittance" | "academicPeriodTransition"
>;

export type FundBalance = { name: string; balance: number };
export type AccountingPeriod = { ay: string; term: string };
export type RolloverSplit = { name: string; cents: number };
export type RolloverMetadata = {
  version: 2;
  sourceAY: string;
  sourceTerm: string;
  splits: RolloverSplit[];
  /** Only new rollovers include these IDs, so reversal can safely undo copied setup fees. */
  copiedFeeIds?: string[];
  copiedFeeSnapshot?: { id: string; category: string; name: string; amount: number; targetFund: string; isPackage: boolean }[];
};
export type ActiveRollover = {
  id: string;
  destinationAY: string;
  destinationTerm: string;
  amount: number;
  legacy: boolean;
};
export type PeriodLedger = {
  funds: FundBalance[];
  totalRemaining: number;
  hasNegativeFunds: boolean;
  negativeFunds: FundBalance[];
  activeRollover: ActiveRollover | null;
  unliquidated: number;
  cashierBalance: number;
  carriedIn: number;
  carriedOut: number;
};

const norm = (value: unknown) => String(value ?? "").trim();

export function toCents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) > MAX_CENTS / 100) {
    throw new Error("Invalid or excessively large monetary amount.");
  }
  return Math.round(n * 100);
}
export const fromCents = (cents: number) => cents / 100;

export function getNextPeriod(ay: string, term: string, calendars: CalendarByYear = {}): AccountingPeriod {
  return followingPeriod(ay, term, calendars);
}

export function isRolloverSource(value: unknown): boolean {
  return /\srollover$/i.test(norm(value));
}

export function sourceLabel(ay: string, term: string): string {
  return `${norm(term)} (${norm(ay)}) Rollover`;
}

export function matchesRolloverSource(
  sourceFund: unknown,
  ay: string,
  term: string
): boolean {
  return norm(sourceFund).toLowerCase() === sourceLabel(ay, term).toLowerCase();
}

export function embedRolloverMetadata(reason: string, meta: RolloverMetadata): string {
  const encoded = Buffer.from(JSON.stringify(meta), "utf8").toString("base64url");
  return `${norm(reason).slice(0, 500)}\n${META_PREFIX}${encoded}]]`;
}

export function parseRolloverMetadata(reason: unknown): RolloverMetadata | null {
  const match = norm(reason).match(/\[\[CLEAR_ROLLOVER_V2:([A-Za-z0-9_-]+)\]\]/);
  if (!match) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(match[1], "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const value = parsed as Partial<RolloverMetadata>;
    if (value.version !== 2 || typeof value.sourceAY !== "string" ||
        typeof value.sourceTerm !== "string" || !Array.isArray(value.splits)) return null;
    if (value.splits.some(s => !s || typeof s.name !== "string" ||
       !Number.isSafeInteger(s.cents) || s.cents <= 0)) return null;
    return value as RolloverMetadata;
  } catch {
    return null;
  }
}

function nameFromRecord(record: any): string {
  const raw = norm(record.fundAllocation || record.fundSource || record.fundName || record.fund);
  // Preserve the historical missing-allocation fallback for older records.
  // This is NOT the destination of new rollover transfers.
  return raw && raw !== "undefined" && raw !== "null" ? raw : "General Fund (Carried Over)";
}

/** Safekeeping transfers cash between locations, not between income/expense accounts. */
export async function getCashierPosition(
  db: Pick<Prisma.TransactionClient, "cashierRemittance">,
  organizationId: string,
  ay: string,
  term: string,
) {
  const records = await db.cashierRemittance.findMany({
    where: { organizationId, academicYear: ay, term },
  });
  const byFund: Record<string, number> = {};
  let totalCents = 0;
  for (const record of records) {
    if (norm(record.status).toUpperCase() !== "REMITTED") continue;
    const cents = toCents(record.amount);
    const direction = record.type === "Deposit" ? 1 : record.type === "Withdrawal" ? -1 : 0;
    const fund = norm(record.fundSource) || "Remaining Balance (Net Ending Position)";
    totalCents += direction * cents;
    byFund[fund] = (byFund[fund] ?? 0) + direction * cents;
  }
  return {
    cashierBalance: fromCents(totalCents),
    balancesByFund: Object.fromEntries(Object.entries(byFund).map(([name, cents]) => [name, fromCents(cents)])) as Record<string, number>,
  };
}

/** A ledger snapshot for a single period. Amounts are kept in integer centavos. */
export async function getPeriodLedger(
  db: LedgerDb,
  organizationId: string,
  ay: string,
  term: string
): Promise<PeriodLedger> {
  const periodWhere = { organizationId, academicYear: ay, term };
  const [collections, audits, advances, allocations, allTransfers, reversals, cashierRecords] =
    await Promise.all([
      db.collection.findMany({ where: periodWhere }),
      db.audit.findMany({ where: periodWhere }),
      db.cashAdvance.findMany({ where: periodWhere }),
      db.fund.findMany({ where: periodWhere }),
      // All periods are required: a rollover is recorded in the *destination* period.
      db.fundTransfer.findMany({ where: { organizationId } }),
      db.voidTransaction.findMany({
        where: { organizationId, transactionType: "ROLLOVER_REVERSAL" },
        select: { referenceId: true },
      }),
      db.cashierRemittance.findMany({ where: periodWhere }),
    ]);

  const balances = new Map<string, number>();
  const add = (name: string, cents: number) => {
    balances.set(name, (balances.get(name) ?? 0) + cents);
  };

  for (const allocation of allocations) {
    if (allocation.fundName) {
      add(allocation.fundName, toCents(allocation.initialAllocation ?? 0));
    }
  }

  for (const collection of collections) {
    const paymentType = norm((collection as any).paymentType).toUpperCase();
    const status = norm((collection as any).status).toUpperCase();
    if (paymentType.includes("VOID") || status.includes("VOID") || status.includes("CANCEL")) continue;
    add(nameFromRecord(collection), toCents((collection as any).amountPaid ?? 0));
  }

  for (const audit of audits) {
    const status = norm((audit as any).status).toUpperCase();
    if (status.includes("VOID") || status.includes("CANCEL")) continue;
    add(nameFromRecord(audit), -toCents((audit as any).totalExpense ?? 0));
  }

  let unliquidatedCents = 0;
  for (const advance of advances) {
    const status = norm(advance.status).toUpperCase();
    const isUnliquidated = status.includes("UNLIQUIDATED");
    if ((status.includes("PENDING") || isUnliquidated || status === "ACTIVE") &&
        !status.includes("CANCEL") && !status.includes("VOID") &&
        (isUnliquidated || !status.includes("LIQUIDATED"))) {
      const cents = toCents(advance.amountApproved ?? 0);
      add(nameFromRecord(advance), -cents);
      unliquidatedCents += cents;
    }
  }

  const reversedIds = new Set(reversals.map(r => norm(r.referenceId)));
  let activeRollover: ActiveRollover | null = null;
  let carriedInCents = 0;
  let carriedOutCents = 0;

  for (const transfer of allTransfers) {
    const rollover = isRolloverSource(transfer.sourceFund);
    if (rollover && reversedIds.has(String(transfer.id))) continue;

    if (rollover && matchesRolloverSource(transfer.sourceFund, ay, term)) {
      // Any active rollover already made from this period, including legacy records.
      activeRollover ??= {
        id: String(transfer.id),
        destinationAY: transfer.academicYear,
        destinationTerm: transfer.term,
        amount: Number(transfer.amount),
        legacy: !parseRolloverMetadata(transfer.reason),
      };
    }

    const metadata = rollover ? parseRolloverMetadata(transfer.reason) : null;
    if (metadata && metadata.sourceAY === ay && metadata.sourceTerm === term) {
      // OUTBOUND effect: removes the source-term balance at the originating pools.
      for (const split of metadata.splits) {
        add(split.name, -split.cents);
        carriedOutCents += split.cents;
      }
    }

    if (transfer.academicYear !== ay || transfer.term !== term) continue;
    const cents = toCents(transfer.amount);
    const source = norm(transfer.sourceFund);
    const destination = norm(transfer.destinationFund);
    if (rollover) {
      // INBOUND effect: add only to destination (no synthetic source pool).
      if (destination) { add(destination, cents); carriedInCents += cents; }
    } else {
      if (source) add(source, -cents);
      if (destination) add(destination, cents);
    }
  }

  const cashierCents = cashierRecords.reduce((total, record) => {
    if (norm(record.status).toUpperCase() !== "REMITTED") return total;
    if (record.type === "Deposit") return total + toCents(record.amount);
    if (record.type === "Withdrawal") return total - toCents(record.amount);
    return total;
  }, 0);

  const funds = Array.from(balances.entries())
    .map(([name, cents]) => ({ name, balance: fromCents(cents) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const negativeFunds = funds.filter(f => toCents(f.balance) < 0);
  const totalCents = Array.from(balances.values()).reduce((a, b) => a + b, 0);

  const formalClosure = await db.academicPeriodTransition.findFirst({
    where: { organizationId, sourceAY: ay, sourceTerm: term, status: "Closed" },
    select: { id: true, transferId: true, destinationAY: true, destinationTerm: true, amount: true },
  });
  if (formalClosure && !activeRollover) {
    activeRollover = { id: formalClosure.transferId || formalClosure.id,
      destinationAY: formalClosure.destinationAY, destinationTerm: formalClosure.destinationTerm,
      amount: moneyNumber(formalClosure.amount), legacy: false };
  }
  return {
    funds,
    totalRemaining: fromCents(totalCents),
    hasNegativeFunds: negativeFunds.length > 0,
    negativeFunds,
    activeRollover,
    unliquidated: fromCents(unliquidatedCents),
    cashierBalance: fromCents(cashierCents),
    carriedIn: fromCents(carriedInCents),
    carriedOut: fromCents(carriedOutCents),
  };
}

/** Read-only closed-period probe; avoids recalculating the treasury ledger.
 * Mirrors full-ledger formal closure, source rollover and reversal behavior.
 * Uncached so new holds/reversals/closures are effective next request.
 */
export async function isAcademicPeriodClosed(
  db: Pick<Prisma.TransactionClient, "academicPeriodTransition" | "fundTransfer" | "voidTransaction">,
  organizationId: string, ay: string, term: string,
): Promise<boolean> {
  const [formal, candidates] = await Promise.all([
    db.academicPeriodTransition.findFirst({
      where: { organizationId, sourceAY: ay, sourceTerm: term, status: "Closed" },
      select: { id: true },
    }),
    db.fundTransfer.findMany({
      where: { organizationId, sourceFund: { contains: "Rollover", mode: "insensitive" } },
      select: { id: true, sourceFund: true },
    }),
  ]);
  if (formal) return true;
  const relevant = candidates.filter(x => matchesRolloverSource(x.sourceFund, ay, term));
  if (!relevant.length) return false;
  const voids = await db.voidTransaction.findMany({
    where: { organizationId, transactionType: "ROLLOVER_REVERSAL",
      referenceId: { in: relevant.map(x => x.id) } },
    select: { referenceId: true },
  });
  const reversed = new Set(voids.map(x => norm(x.referenceId)));
  return relevant.some(x => !reversed.has(norm(x.id)));
}
