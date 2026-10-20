import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Retry only Prisma serialization/deadlock conflicts. Callbacks must contain
 * database work only: do not send emails, write blobs, or call external APIs
 * inside a retried transaction. Enqueue notifications transactionally instead.
 */
export async function withFinancialTransaction<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  options: { maxAttempts?: number; timeoutMs?: number } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const timeout = options.timeoutMs ?? 20_000;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) {
    throw new Error("Invalid transaction retry limit.");
  }
  if (!Number.isInteger(timeout) || timeout < 1_000 || timeout > 60_000) {
    throw new Error("Invalid transaction timeout.");
  }
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout,
      });
    } catch (error: unknown) {
      if ((error as { code?: string })?.code !== "P2034" || attempt === maxAttempts) {
        throw error;
      }
    }
  }
  throw new Error("Financial transaction retry limit reached.");
}

/** Validate peso amounts without allowing sub-cent rounding or unsafe integers. */
export function positiveMoneyCents(value: unknown, label = "Amount"): number {
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error(`${label} must be numeric.`);
  }
  if (typeof value === "string" && !/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value.trim())) {
    throw new Error(`${label} must have at most two decimal places.`);
  }
  const amount = Number(value);
  const cents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(cents) ||
      Math.abs(amount * 100 - cents) > 0.000001) {
    throw new Error(`${label} must be a positive, valid two-decimal amount.`);
  }
  return cents;
}
