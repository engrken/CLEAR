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
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${organizationId}), hashtext(${orNumber}))::text AS locked`;
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

/**
 * Generates a server-owned OR inside the posting transaction.
 * Requires the clear_receipt_sequence migration before deployment.
 * The sequence is global, so two organizations cannot receive the same OR.
 * Sequence gaps after rollback are expected and must not be reused.
 */
export async function allocateOfficialReceiptNumber(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<string> {
  const result = await tx.$queryRaw<Array<{ receipt_seq: bigint; issued_at: Date }>>`
    SELECT nextval('clear_receipt_sequence'::regclass) AS receipt_seq,
           CURRENT_TIMESTAMP AS issued_at
  `;
  const record = result[0];
  if (!record) throw new Error("Unable to allocate an official receipt number.");
  // Use UTC for an unambiguous, deployment-independent timestamp.
  const stamp = record.issued_at.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const orNumber = `OR-${stamp.slice(0, 8)}-${stamp.slice(8)}-${String(record.receipt_seq).padStart(6, "0")}`;
  await lockReceiptNumber(tx, organizationId, orNumber);
  const conflict = await tx.collection.findFirst({
    where: receiptNumberConflictWhere(organizationId, orNumber),
    select: { id: true },
  });
  if (conflict) throw new Error("Generated receipt number conflicts with an existing receipt.");
  return orNumber;
}
