import type { Prisma } from "@prisma/client";

/**
 * Serializes attempts to post the same OR within an organization. This is
 * transaction-scoped: PostgreSQL releases the advisory lock at commit/rollback.
 * Call before checking for an existing receipt, inside a DB transaction.
 */
export async function lockReceiptNumber(
  tx: Prisma.TransactionClient,
  organizationId: string,
  rawOr: string,
): Promise<void> {
  const orNumber = rawOr.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,50}$/.test(orNumber)) {
    throw new Error("Invalid official receipt number.");
  }
  // Two independent 32-bit hash keys; collision only causes extra waiting,
  // never permits duplicate postings. Never interpolate user input into SQL.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}), hashtext(${orNumber}))`;
}

/**
 * A receipt may have multiple package lines. Detect exact ORs and derived
 * package suffixes without imposing uniqueness on organizationId + orNumber.
 */
export function receiptNumberConflictWhere(organizationId: string, rawOr: string) {
  const orNumber = rawOr.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,50}$/.test(orNumber)) {
    throw new Error("Invalid official receipt number.");
  }
  return {
    organizationId,
    OR: [
      { orNumber },
      { orNumber: { startsWith: `${orNumber}-P` } },
    ],
  };
}
