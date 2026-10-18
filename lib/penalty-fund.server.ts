import "server-only";
import type { Prisma } from "@prisma/client";
import { PENALTY_FUND_NAME } from "@/lib/penalty-fund";

/**
 * Ensures the fund ACCOUNT exists, without transferring cash or changing its
 * opening allocation. This is safe for legacy tenants with prior receipts.
 * Must be called INSIDE the transaction that assesses or receives a penalty.
 * The caller MUST authorize the tenant and reject closed periods first.
 */
export async function ensurePenaltyFund(
  tx: Pick<Prisma.TransactionClient, "fund">,
  organizationId: string,
  academicYear: string,
  term: string,
) {
  if (!organizationId.trim() || !academicYear.trim() || !term.trim()) {
    throw new Error("Organization and academic period are required for the penalty fund.");
  }
  const period = { organizationId, academicYear, term, fundName: PENALTY_FUND_NAME };
  return tx.fund.upsert({
    where: { organizationId_academicYear_term_fundName: period },
    create: { ...period, initialAllocation: 0, currentBalance: 0 },
    update: {},
  });
}
