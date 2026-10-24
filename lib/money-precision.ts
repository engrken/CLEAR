/**
 * Strict server/client-safe Decimal boundary for monetary read models.
 * Prisma Decimal objects stringify to their canonical decimal representation.
 * Keep calculations and network payloads in integer centavos where possible.
 * Do not coerce precision problems into 0 or round them away.
 */
export type MoneyScalar = number | string | { toString(): string };

export function moneyCentavos(value: MoneyScalar): number {
  const source = String(value);
  const parts = /^(-?)(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(source);
  if (!parts) throw new Error("Invalid exact monetary amount.");
  const centavos = BigInt(parts[2]) * BigInt(100) +
    BigInt((parts[3] ?? "").padEnd(2, "0") || "0");
  const signed = parts[1] === "-" ? -centavos : centavos;
  if (signed > BigInt(Number.MAX_SAFE_INTEGER) ||
    signed < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error("Monetary amount exceeds safe centavo range.");
  }
  return Number(signed);
}

export function moneyNumber(value: MoneyScalar): number {
  return moneyCentavos(value) / 100;
}
