/**
 * Read-only collection summary with a category heading and item-level lines.
 *
 * Amounts use integer centavos so every displayed line reconciles to the
 * actual valid cash receipts. This never modifies a transaction or fund.
 * Student and receipt identifiers are used for distinct counts but never
 * returned to the report client.
 */
export type SummaryReceipt = {
  studentId: string | null;
  studentName: string | null;
  category: string | null;
  itemDescription: string | null;
  amountPaid: number | null;
  status: string | null;
  paymentType: string | null;
};

export type SummaryFeeSetup = {
  name: string;
  category: string;
  amount: number;
  isPackage: boolean;
};

export type SummaryCollectionCategory = {
  category: string;
  items: { name: string; count: number; amount: number }[];
};

const PACKAGE_DESCRIPTIONS = new Set([
  "departmental fee package",
  "departmental fee",
  "departmental fee package (all items)",
]);

function isVoided(row: SummaryReceipt): boolean {
  return /VOID|CANCEL/i.test(String(row.status || "") + " " + String(row.paymentType || ""));
}

const PENALTY_SUMMARY_LABEL = "Penalty / Fines";

/** All historic penalty receipt formats share ONE presentation group.
 * This is display-only: the original receipt category, OR and allocated fund
 * remain authoritative in the ledger, and are never rewritten here.
 */
function isPenaltyItem(description: string): boolean {
  return /^Penalty\s*\/\s*Fines$/i.test(description) ||
    /^Penalty Fine(?:\s*\[[^\]]*\])?(?::|$)/i.test(description);
}

function displayItemName(description: string, fallbackCategory: string): string {
  const desc = description.trim();
  // The summary aggregates historical cash settlement descriptions by type,
  // not by penalty ID, so names and references are not exposed to the client.
  if (isPenaltyItem(desc)) return PENALTY_SUMMARY_LABEL;
  // Do not expose student names/IDs embedded in legacy arrears item labels.
  const arrears = /^Arrears:\s*(.+?)\s+-\s+.+\([^)]*\)\s*$/i.exec(desc);
  if (arrears) return "Arrears: " + arrears[1].trim();
  return desc || fallbackCategory || "Unspecified Collection";
}

/** An exact-centavo partition of one received package payment. */
function distributePackageCents(
  cents: number,
  setups: readonly SummaryFeeSetup[],
): { name: string; cents: number }[] {
  const active = setups.filter(s => s.isPackage && Number(s.amount) > 0 && s.name.trim());
  const totalRate = active.reduce((sum, s) => sum + Number(s.amount), 0);
  if (!active.length || totalRate <= 0) return [];

  let assigned = 0;
  return active.map((setup, index) => {
    const part = index === active.length - 1
      ? cents - assigned
      : Math.floor(cents * Number(setup.amount) / totalRate);
    assigned += part;
    return { name: setup.name.trim(), cents: part };
  });
}

export function itemizeCollectionsForSummary(
  receipts: readonly SummaryReceipt[],
  setups: readonly SummaryFeeSetup[],
): SummaryCollectionCategory[] {
  const feeByName = new Map<string, string>();
  const configuredCategories = new Set<string>();
  for (const setup of setups) {
    const cat = String(setup.category || "").trim();
    const name = String(setup.name || "").trim().toLowerCase();
    configuredCategories.add(cat.toLowerCase());
    if (name && !feeByName.has(name)) feeByName.set(name, cat);
  }

  type ItemBucket = { name: string; cents: number; students: Set<string> };
  type CategoryBucket = { name: string; items: Map<string, ItemBucket> };
  const grouped = new Map<string, CategoryBucket>();

  for (const receipt of receipts) {
    if (isVoided(receipt)) continue;
    const cents = Math.round(Number(receipt.amountPaid || 0) * 100);
    if (!Number.isFinite(cents) || cents <= 0) continue;

    const description = String(receipt.itemDescription || "").trim();
    const receiptCategory = String(receipt.category || "").trim();
    let category = isPenaltyItem(description) ||
      /^Penalty(?:\s*\/\s*Fines)?$/i.test(receiptCategory)
      ? PENALTY_SUMMARY_LABEL
      : (configuredCategories.has(receiptCategory.toLowerCase())
        ? receiptCategory
        : feeByName.get(description.toLowerCase()) || receiptCategory || "Other Collections");

    if (/^Departmental Fee Package/i.test(description)) category = "Departmental Fee";

    const key = String(receipt.studentId || receipt.studentName || "").trim().toLowerCase();

    const addLine = (name: string, partCents: number) => {
      if (partCents <= 0) return;
      const categoryId = category.toLowerCase();
      let cat = grouped.get(categoryId);
      if (!cat) {
        cat = { name: category, items: new Map() };
        grouped.set(categoryId, cat);
      }
      const itemId = name.toLowerCase().replace(/\s+/g, " ").trim();
      let item = cat.items.get(itemId);
      if (!item) {
        item = { name, cents: 0, students: new Set() };
        cat.items.set(itemId, item);
      }
      item.cents += partCents;
      if (key) item.students.add(key);
    };

    const packageItems = PACKAGE_DESCRIPTIONS.has(description.toLowerCase())
      ? distributePackageCents(cents, setups)
      : [];
    if (packageItems.length) {
      for (const item of packageItems) addLine(item.name, item.cents);
    } else {
      addLine(displayItemName(description, receiptCategory), cents);
    }
  }

  return Array.from(grouped.values())
    .map(group => ({
      category: group.name,
      items: Array.from(group.items.values())
        .map(item => ({ name: item.name, count: item.students.size, amount: item.cents / 100 }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.category.localeCompare(b.category));
}
