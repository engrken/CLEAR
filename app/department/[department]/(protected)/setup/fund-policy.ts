/**
 * Authoritative fund-pool dependency check. Pure server helper, not an action.
 * A referenced fund is never renamed, removed, or assigned a different opening balance.
 * Historical voided/reversed records still count as references for audit integrity.
 */
import type { Prisma } from "@prisma/client";
import { parseRolloverMetadata, matchesRolloverSource } from "../realign/ledger";

const key = (ay: string, term: string) => `${ay}|${term}`;
const norm = (value: unknown) => String(value ?? "").trim().toLowerCase();
const refKey = (ay: string, term: string, name: string) => `${key(ay, term)}|${norm(name)}`;

type Db = Pick<Prisma.TransactionClient,
  "collection" | "audit" | "cashAdvance" | "cashierRemittance" |
  "fundTransfer" | "collectionSetup" | "fundRealignment" | "penalty" | "voidTransaction" |
  "collectible" | "onlineRemittance">;
export type FundIdentity = { id: string; fundName: string; academicYear: string; term: string };

export async function inspectFundUsage(db: Db, organizationId: string, funds: FundIdentity[]) {
  const org = { organizationId };
  const [receipts, audits, advances, cashier, fees, transfers, legacyRealignments, penalties, reversals, dues, remittances] = await Promise.all([
    db.collection.findMany({ where: org, select: { academicYear: true, term: true, fundAllocation: true } }),
    db.audit.findMany({ where: org, select: { academicYear: true, term: true, fundSource: true } }),
    db.cashAdvance.findMany({ where: org, select: { academicYear: true, term: true, fundSource: true } }),
    db.cashierRemittance.findMany({ where: org, select: { academicYear: true, term: true, fundSource: true } }),
    db.collectionSetup.findMany({ where: org, select: { academicYear: true, term: true, targetFund: true } }),
    db.fundTransfer.findMany({ where: org, select: { id: true, academicYear: true, term: true, sourceFund: true, destinationFund: true, reason: true } }),
    db.fundRealignment.findMany({ where: org, select: { sourceFund: true, targetFund: true } }),
    db.penalty.findMany({ where: org, select: { academicYear: true, term: true } }),
    db.voidTransaction.findMany({ where: { ...org, transactionType: "ROLLOVER_REVERSAL" }, select: { referenceId: true } }),
    db.collectible.findMany({ where: org, select: { academicYear: true, term: true, category: true } }),
    db.onlineRemittance.findMany({ where: org, select: { academicYear: true, term: true } }),
  ]);
  const referenced = new Map<string, string>();
  const periodsWithActivity = new Set<string>();
  const closedPeriods = new Set<string>();
  const add = (ay: string, term: string, name: string, reason: string) => {
    if (!name?.trim()) return;
    const k = refKey(ay, term, name);
    if (!referenced.has(k)) referenced.set(k, reason);
  };
  for (const row of receipts) { add(row.academicYear,row.term,row.fundAllocation,"Official receipt history"); periodsWithActivity.add(key(row.academicYear,row.term)); }
  for (const row of audits) { add(row.academicYear,row.term,row.fundSource,"Liquidation / audited expense"); periodsWithActivity.add(key(row.academicYear,row.term)); }
  for (const row of advances) { add(row.academicYear,row.term,row.fundSource,"Cash advance history"); periodsWithActivity.add(key(row.academicYear,row.term)); }
  for (const row of cashier) { add(row.academicYear,row.term,row.fundSource,"University Cashier custody history"); periodsWithActivity.add(key(row.academicYear,row.term)); }
  for (const row of fees) { add(row.academicYear,row.term,row.targetFund,"Collection Fee Setup reference"); }
  for (const row of penalties) {
    // The universal penalty policy reserves this fund even without a paid receipt.
    add(row.academicYear,row.term,"Penalty Fund","Penalty assessment history");
    periodsWithActivity.add(key(row.academicYear,row.term));
  }
  for (const row of dues) {
    periodsWithActivity.add(key(row.academicYear, row.term));
    // The schema stores no targetFund on Collectible. Fee Setup locks the
    // relevant pool by targetFund; do not infer a fund from the category label.
  }
  for (const row of remittances) periodsWithActivity.add(key(row.academicYear, row.term));
  const reversed = new Set(reversals.map(row => row.referenceId));
  for (const transfer of transfers) {
    const { academicYear: ay, term } = transfer;
    periodsWithActivity.add(key(ay, term));
    const isRollover = /\srollover$/i.test(transfer.sourceFund.trim());
    if (!isRollover) {
      add(ay,term,transfer.sourceFund,"Fund transfer history");
      add(ay,term,transfer.destinationFund,"Fund transfer history");
      continue;
    }
    add(ay,term,transfer.destinationFund,"Incoming rollover history");
    const meta = parseRolloverMetadata(transfer.reason);
    if (meta) {
      periodsWithActivity.add(key(meta.sourceAY,meta.sourceTerm));
      for (const split of meta.splits) add(meta.sourceAY,meta.sourceTerm,split.name,"Outgoing rollover history");
      if (!reversed.has(transfer.id)) closedPeriods.add(key(meta.sourceAY,meta.sourceTerm));
    } else {
      // Legacy transfers have no per-fund splits. Protect ALL source-period
      // funds instead of guessing which historical pool contributed money.
      for (const saved of funds) {
        if (matchesRolloverSource(transfer.sourceFund,saved.academicYear,saved.term)) {
          add(saved.academicYear,saved.term,saved.fundName,"Legacy rollover history");
          periodsWithActivity.add(key(saved.academicYear,saved.term));
          if (!reversed.has(transfer.id)) closedPeriods.add(key(saved.academicYear,saved.term));
        }
      }
    }
  }
  // Legacy FundRealignment has no academic-year/term columns in schema.
  // Protect matching funds across this tenant's periods; do not guess its period.
  const globalReferences = new Set(legacyRealignments.flatMap(row => [norm(row.sourceFund),norm(row.targetFund)]));
  for (const fund of funds) {
    if (globalReferences.has(norm(fund.fundName))) {
      add(fund.academicYear,fund.term,fund.fundName,"Legacy fund realignment history (period unspecified)");
    }
  }
  return { referenced, periodsWithActivity, closedPeriods, refKey, periodKey: key };
}
