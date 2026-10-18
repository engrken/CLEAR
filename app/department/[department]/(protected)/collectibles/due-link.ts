/**
 * Compatibility link for individual collectible assessments in installations whose
 * Prisma Collectible model has no studentId/itemDescription fields.
 * The status marker is an interim format. Prefer schema columns in a future migration.
 */
import type { Prisma } from "@prisma/client";

export function decodeStudentDue(status: unknown): { studentId: string; itemDescription: string } | null {
  const text = String(status || "");
  const match = text.match(/\|SID:([^|]+)\|ITEM:([^|]+)/);
  if (!match) return null;
  try {
    return { studentId: decodeURIComponent(match[1]), itemDescription: decodeURIComponent(match[2]) };
  } catch { return null; }
}

export function activeCollectibleDue(row: { status?: unknown; balanceDue?: unknown }): boolean {
  const s = String(row.status || "").toUpperCase();
  return Number(row.balanceDue || 0) > 0 && !s.includes("VOID") && !s.includes("CANCEL") && !s.startsWith("PAID") && !s.includes("SETTLED");
}

export async function applyPaymentToStudentCollectibles(
  tx: Pick<Prisma.TransactionClient, "collectible">,
  args: { organizationId: string; academicYear: string; term: string;
    studentId: string; category: string; itemDescription: string; amountCents: number }
): Promise<number> {
  if (!Number.isSafeInteger(args.amountCents) || args.amountCents <= 0) return 0;
  if (!String(args.category || "").trim()) throw new Error("Payment category is required to match a student assessment safely.");
  const items = await tx.collectible.findMany({ where: {
    organizationId: args.organizationId,
    academicYear: args.academicYear,
    term: args.term,
  } });
  const matches = items.filter(due => {
    if (!activeCollectibleDue(due)) return false;
    const marker = decodeStudentDue(due.status);
    return Boolean(marker &&
      marker.studentId.toLowerCase() === args.studentId.toLowerCase() &&
      marker.itemDescription.trim().toLowerCase() === args.itemDescription.trim().toLowerCase() &&
      due.category.trim().toLowerCase() === args.category.trim().toLowerCase());
  });
  // Never spread a single payment across multiple same-named assessments.
  if (matches.length > 1) {
    throw new Error("Multiple active assessments match this student, category, and fee. Reconcile duplicates before recording payment.");
  }
  const due = matches[0];
  if (!due) return 0; // An ordinary configured fee without a separate due.
  const centsDue = Math.round(Number(due.balanceDue || 0) * 100);
  const applied = Math.min(args.amountCents, centsDue);
  if (applied <= 0) return 0;
  const centsLeft = centsDue - applied;
  const outcome = await tx.collectible.updateMany({
    where: { id: due.id, organizationId: args.organizationId,
      balanceDue: due.balanceDue, status: due.status },
    data: { balanceDue: centsLeft / 100,
      status: centsLeft === 0 ? String(due.status).replace(/^Unpaid/i, "Paid") : due.status },
  });
  if (outcome.count !== 1) throw new Error("This student's outstanding due changed during payment. Retry the entire transaction.");
  return applied;
}
