/**
 * Read-only, deterministic centavo allocation for legacy single-line package receipts.
 *
 * The source Collection amount is authoritative. This function never changes an
 * official receipt, a student obligation, or a stored fund ledger. It prevents
 * fractional centavos from leaking into web/mobile summary breakdowns.
 *
 * Largest-remainder allocation preserves the receipt total exactly. Equal
 * remainders are assigned by stable fee-configuration order.
 */
export function allocateLegacyPackageCents(
  amountPesos: number,
  ratePesos: readonly number[],
): number[] {
  const cents = Math.round(Math.abs(amountPesos) * 100);
  if (!Number.isFinite(amountPesos) || !Number.isSafeInteger(cents)) {
    throw new Error("Invalid legacy receipt amount.");
  }
  const weights = ratePesos.map((value) => {
    const rateCents = Math.round(Number(value) * 100);
    if (!Number.isFinite(value) || !Number.isSafeInteger(rateCents) || rateCents < 0) {
      throw new Error("Invalid package allocation weight.");
    }
    return BigInt(rateCents);
  });
  const denominator = weights.reduce((sum, value) => sum + value, 0n);
  if (denominator === 0n) return [];
  const numerator = BigInt(cents);
  const distributed = weights.map((weight) => Number((numerator * weight) / denominator));
  const remainders = weights.map((weight) => (numerator * weight) % denominator);
  let balance = cents - distributed.reduce((sum, value) => sum + value, 0);
  const ranked = weights.map((_, index) => index).sort((a, b) => {
    if (remainders[a] === remainders[b]) return a - b;
    return remainders[a] > remainders[b] ? -1 : 1;
  });
  for (let i = 0; i < balance; i++) distributed[ranked[i]]++;
  const sign = amountPesos < 0 ? -1 : 1;
  return distributed.map((value) => (value * sign) / 100);
}
