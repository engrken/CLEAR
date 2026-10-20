/**
 * Server-side selection of receiptable items. Do not infer a package category
 * from other fees in the academic period or from an officer-selected fund.
 *
 * A legacy non-package proof may lack a category; accept only when its fee name
 * is unambiguous across the period. Packages require an explicit category.
 */
export const REMITTANCE_PACKAGE_LABEL = "Departmental Fee (Full Package)";
export const LEGACY_PACKAGE_LABEL = "Departmental Fee Package (All Items)";

export type RemittanceFeeSetup = {
  category: string;
  name: string;
  amount: number;
  isPackage: boolean;
  targetFund: string;
};

export type RemittanceFeeSelection =
  | { kind: "package"; category: string; items: RemittanceFeeSetup[] }
  | { kind: "single"; category: string; setup: RemittanceFeeSetup };

const key = (s: unknown) => String(s ?? "").trim().toLowerCase();
const generic = (s: unknown) => !key(s) || key(s) === "online remittance";

export function isRemittancePackageDescription(description: unknown): boolean {
  return [REMITTANCE_PACKAGE_LABEL, LEGACY_PACKAGE_LABEL].some(s => key(s) === key(description));
}

export function selectConfiguredRemittanceFee(
  setups: readonly RemittanceFeeSetup[],
  submission: { itemDescription: string; category?: string | null },
): RemittanceFeeSelection {
  const itemKey = key(submission.itemDescription);
  const categoryKey = generic(submission.category) ? "" : key(submission.category);
  if (!itemKey) throw new Error("A configured Fee Setup item is required.");

  if (isRemittancePackageDescription(submission.itemDescription)) {
    if (!categoryKey) {
      throw new Error("Package payment proof has no explicitly selected fee category. Reject the legacy proof and ask the student to resubmit with a category.");
    }
    const items = setups.filter(s => s.isPackage && key(s.category) === categoryKey);
    if (!items.length) {
      throw new Error("No package Fee Setup is configured for the selected category and academic term.");
    }
    const selectedNames = new Set<string>();
    for (const item of items) {
      const nameKey = key(item.name);
      if (!nameKey || selectedNames.has(nameKey) ||
          setups.filter(s => key(s.name) === nameKey).length !== 1) {
        throw new Error("Ambiguous package fee descriptions. Reconcile Fee Setup before verification.");
      }
      selectedNames.add(nameKey);
    }
    return { kind: "package", category: items[0].category, items };
  }

  const sameName = setups.filter(s => key(s.name) === itemKey);
  if (!sameName.length) {
    throw new Error("This payment item is not configured in Fee Setup for this department and term.");
  }
  if (sameName.length !== 1) {
    throw new Error("Fee Setup contains an ambiguous or duplicate item name. Reconcile categories before verification.");
  }
  const setup = sameName[0];
  if (categoryKey && categoryKey !== key(setup.category)) {
    throw new Error("Payment category does not match the configured Fee Setup category.");
  }
  return { kind: "single", category: setup.category, setup };
}
