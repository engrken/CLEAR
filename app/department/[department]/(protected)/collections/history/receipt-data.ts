import "server-only";
import { prisma } from "@/lib/prisma";

// The first Collection line holds the base OR; additional package allocations
// are saved as OR-P02, OR-P03, etc. Do not treat them as separate receipts.
export const cleanOrNumber = (value: unknown): string => {
  const orNumber = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,49}$/.test(orNumber) || /-P\d+$/i.test(orNumber)) {
    throw new Error("Invalid base official receipt number.");
  }
  return orNumber;
};
export const isVoidedLine = (row: { status: string; paymentType: string }) =>
  /VOID|CANCEL|REJECT/i.test(`${row.status} ${row.paymentType}`);

export async function getReceiptLines(organizationId: string, baseOr: string) {
  const orNumber = cleanOrNumber(baseOr);
  const rows = await prisma.collection.findMany({
    where: {
      organizationId,
      OR: [{ orNumber }, { orNumber: { startsWith: `${orNumber}-P` } }],
    },
    orderBy: [{ timestamp: "asc" }, { orNumber: "asc" }],
  });
  if (!rows.some((r) => r.orNumber.toUpperCase() === orNumber)) return [];
  // Avoid collecting accidentally matching names like 26-001-PLUS.
  return rows.filter((r) => r.orNumber.toUpperCase() === orNumber ||
    new RegExp(`^${orNumber}-P\\d+$`, "i").test(r.orNumber));
}

export function receiptStatus(rows: Array<{ status: string; paymentType: string }>) {
  if (!rows.length) return "Missing";
  const count = rows.filter(isVoidedLine).length;
  if (count === rows.length) return "Voided";
  if (count > 0) return "Inconsistent";
  return "Valid";
}
export const money = (v: number) => `₱${Number(v).toLocaleString("en-PH", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})}`;
