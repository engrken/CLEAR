/**
 * Cashier-only balance preview math. Server actions continue to authorize and
 * recompute all payment constraints atomically at posting time.
 */
export const PACKAGE_NAME = "Departmental Fee Package (All Items)";

const keyOf = (value) => String(value ?? "").trim().toLowerCase();
const cents = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || Math.abs(amount) > Number.MAX_SAFE_INTEGER / 100) {
    throw new Error("Invalid monetary amount");
  }
  return Math.round(amount * 100);
};

// Mirrors collection posting: count non-void, non-cancelled receipts only.
// Group by item description because recordPayment's prevFor uses that key.
export function summarizeValidCollectionCredits(rows) {
  const totals = new Map();
  for (const row of rows) {
    if (/VOID|CANCEL/i.test(String(row.status ?? "")) ||
        /VOID/i.test(String(row.paymentType ?? ""))) continue;
    const itemDescription = keyOf(row.itemDescription);
    if (!itemDescription) continue;
    totals.set(itemDescription, (totals.get(itemDescription) ?? 0) + cents(row.amountPaid));
  }
  return [...totals].map(([itemDescription, paidCents]) => ({ itemDescription, paidCents }));
}

export function calculateCollectionBalancePreview({
  credits, itemDescription, standardRate, packageItems = [],
  isPenalty = false, penaltyBalance = null, prefillLimit = null,
}) {
  const paidByItem = new Map();
  for (const credit of credits) {
    const key = keyOf(credit.itemDescription);
    paidByItem.set(key, (paidByItem.get(key) ?? 0) + credit.paidCents);
  }
  const paidFor = (description) => paidByItem.get(keyOf(description)) ?? 0;
  let dueCents;
  let alreadyPaidCents;

  if (isPenalty) {
    // Penalty.fineAmount is already the live outstanding balance.
    dueCents = Math.max(0, cents(penaltyBalance ?? standardRate));
    alreadyPaidCents = 0;
  } else if (itemDescription === PACKAGE_NAME) {
    // Match server package allocation: individual item receipts first,
    // then apply legacy, single-row package credit across remaining items.
    let legacyCredits = paidFor(PACKAGE_NAME);
    let totalRate = 0;
    dueCents = 0;
    for (const item of packageItems) {
      const rate = cents(item.amount);
      totalRate += rate;
      const available = Math.max(0, rate - paidFor(item.name));
      const legacyApplied = Math.min(Math.max(0, legacyCredits), available);
      legacyCredits -= legacyApplied;
      dueCents += available - legacyApplied;
    }
    alreadyPaidCents = Math.max(0, totalRate - dueCents);
  } else {
    const rate = Math.max(0, cents(standardRate));
    alreadyPaidCents = Math.max(0, paidFor(itemDescription));
    dueCents = Math.max(0, rate - paidFor(itemDescription));
  }

  const payableCents = prefillLimit != null && !isPenalty
    ? Math.min(dueCents, Math.max(0, cents(prefillLimit)))
    : dueCents;
  return { dueCents, alreadyPaidCents, payableCents };
}
