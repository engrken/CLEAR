/**
 * Read-only issued receipt aggregation.
 *
 * Legacy package: several Collection rows share the SAME base OR.
 * Current package: base OR + '-P02', '-P03'... allocation rows.
 * The financial ledger intentionally remains at allocation-line granularity.
 */
export type HistoryLine = {
  id: string;
  orNumber: string;
  studentId: string | null;
  studentName: string;
  student: { studentId: string } | null;
  academicYear: string;
  term: string;
  date: Date | string;
  timestamp: Date | string;
  encodedBy: string | null;
  category: string;
  itemDescription: string;
  paymentType: string;
  status: string;
  amountPaid: number;
};

export type IssuedReceipt = {
  key: string;
  orNumber: string;
  studentName: string;
  studentNumber: string;
  date: string;
  timestamp: string;
  academicYear: string;
  term: string;
  encodedBy: string;
  status: "Valid" | "Voided" | "Inconsistent";
  inconsistencyReason: string;
  total: number;
  count: number;
  description: string;
  categories: string[];
  descriptions: string[];
  paymentTypes: string[];
};

const VOID_RE = /VOID|CANCEL|REJECT/i;
const formatOR = (value: string) => value.trim().toUpperCase();
export const baseOfficialReceiptNumber = (value: string) =>
  formatOR(value).replace(/-P\d+$/i, "");

export function buildIssuedReceipts(lines: HistoryLine[]): IssuedReceipt[] {
  const groups = new Map<string, HistoryLine[]>();
  for (const line of lines) {
    const orNumber = baseOfficialReceiptNumber(line.orNumber);
    // Keep different academic periods separately; never combine their balances.
    const key = JSON.stringify([line.academicYear, line.term, orNumber]);
    const group = groups.get(key) ?? [];
    group.push(line);
    groups.set(key, group);
  }

  const receipts: IssuedReceipt[] = [];
  for (const [key, group] of groups) {
    const base = baseOfficialReceiptNumber(group[0].orNumber);
    const root = group.find(row => formatOR(row.orNumber) === base) ?? group[0];
    const reasons: string[] = [];
    if (!group.some(row => formatOR(row.orNumber) === base)) {
      reasons.push("No base official receipt allocation line");
    }

    const identities = new Set(group.map(row =>
      row.studentId ? `id:${row.studentId}` : `name:${row.studentName.trim().toLowerCase()}`
    ));
    if (identities.size > 1) {
      reasons.push("Conflicting students share one official receipt number");
    }
    const voided = group.filter(row => VOID_RE.test(`${row.status} ${row.paymentType}`)).length;
    if (voided > 0 && voided < group.length) {
      reasons.push("Mixed valid and voided allocation lines");
    }
    if (group.some(row => !Number.isFinite(row.amountPaid))) {
      reasons.push("Non-finite monetary amount in receipt allocations");
    }
    const status = reasons.length
      ? "Inconsistent"
      : voided === group.length ? "Voided" : "Valid";

    const dated = [...group].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    receipts.push({
      key,
      orNumber: base,
      studentName: root.studentName,
      studentNumber: root.student?.studentId || "",
      date: new Date(root.date).toISOString(),
      timestamp: new Date(dated[0].timestamp).toISOString(),
      academicYear: root.academicYear,
      term: root.term,
      encodedBy: root.encodedBy || "",
      status,
      inconsistencyReason: reasons.join("; "),
      total: group.reduce((sum, row) => sum + Math.round(row.amountPaid * 100), 0) / 100,
      count: group.length,
      description: group.map(row => row.itemDescription).join("; ").slice(0, 260),
      categories: [...new Set(group.map(row => row.category).filter(Boolean))].sort(),
      descriptions: group.map(row => row.itemDescription),
      paymentTypes: [...new Set(group.map(row => row.paymentType).filter(Boolean))].sort(),
    });
  }

  // A repeated OR across academic periods is not necessarily an extra receipt;
  // prevent the display from implying the OR is globally unambiguous.
  const receiptPeriods = new Map<string, number>();
  for (const receipt of receipts) {
    receiptPeriods.set(receipt.orNumber, (receiptPeriods.get(receipt.orNumber) ?? 0) + 1);
  }
  for (const receipt of receipts) {
    if ((receiptPeriods.get(receipt.orNumber) ?? 0) > 1) {
      receipt.status = "Inconsistent";
      receipt.inconsistencyReason = [
        receipt.inconsistencyReason,
        "Official receipt number is reused across academic periods",
      ].filter(Boolean).join("; ");
    }
  }

  return receipts.sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp) || a.orNumber.localeCompare(b.orNumber)
  );
}

export type ReceiptFilter = {
  q: string;
  exactOr: string;
  status: string;
  category: string;
  description: string;
  paymentType: string;
  from: string;
  to: string;
  inconsistentOnly: boolean;
};

export function filterIssuedReceipts(receipts: IssuedReceipt[], filter: ReceiptFilter) {
  const q = filter.q.trim().toLowerCase();
  const exactOr = formatOR(filter.exactOr);
  const category = filter.category.trim().toLowerCase();
  const description = filter.description.trim().toLowerCase();
  const payment = filter.paymentType.trim().toLowerCase();

  return receipts.filter(receipt => {
    if (q && ![receipt.orNumber, receipt.studentName, receipt.studentNumber]
      .some(value => value.toLowerCase().includes(q))) return false;
    if (exactOr && receipt.orNumber !== exactOr) return false;
    if (filter.inconsistentOnly && receipt.status !== "Inconsistent") return false;
    if (filter.status === "valid" && receipt.status !== "Valid") return false;
    if (filter.status === "voided" && receipt.status !== "Voided") return false;
    if (filter.status === "inconsistent" && receipt.status !== "Inconsistent") return false;
    if (category && !receipt.categories.some(value => value.toLowerCase() === category)) return false;
    if (description && !receipt.descriptions.some(value => value.toLowerCase().includes(description))) return false;
    if (payment && !receipt.paymentTypes.some(value => value.toLowerCase() === payment)) return false;
    const date = receipt.date.slice(0, 10);
    if (filter.from && date < filter.from) return false;
    if (filter.to && date > filter.to) return false;
    return true;
  });
}
