// Read-only grouping for both current (-P02 splits) and historical
// packages that stored multiple allocation lines under the same base OR.
export type ReceiptHistoryLine = {
  orNumber: string;
  studentName: string;
  studentId: string | null;
  studentNumber: string;
  date: Date;
  timestamp: Date;
  academicYear: string;
  term: string;
  encodedBy: string | null;
  category: string;
  itemDescription: string;
  amountPaid: number;
  status: string;
  paymentType: string;
};

export type ReceiptHistoryRow = {
  orNumber: string;
  studentName: string;
  studentNumber: string;
  date: string;
  timestamp: string;
  academicYear: string;
  term: string;
  encodedBy: string;
  status: string;
  total: number;
  count: number;
  description: string;
  categories: string[];
};

const baseOr = (value: string) => value.trim().toUpperCase().replace(/-P\d+$/i, "");

export function buildReceiptHistoryRows(
  lines: ReceiptHistoryLine[],
  getStatus: (rows: Array<{ status: string; paymentType: string }>) => string,
): ReceiptHistoryRow[] {
  const groups = new Map<string, ReceiptHistoryLine[]>();
  for (const line of lines) {
    const key = baseOr(line.orNumber);
    const rows = groups.get(key) ?? [];
    rows.push(line);
    groups.set(key, rows);
  }

  const receipts: ReceiptHistoryRow[] = [];
  for (const [key, group] of groups) {
    const baseRows = group.filter(line => line.orNumber.trim().toUpperCase() === key);
    // A suffix without its base OR is not an independently issued receipt.
    if (baseRows.length === 0) continue;

    // Stable root choice even if a legacy package has four base lines.
    const root = baseRows.reduce((latest, current) =>
      current.timestamp.getTime() > latest.timestamp.getTime() ? current : latest);

    const mismatchedIdentity = group.some(line =>
      line.academicYear !== root.academicYear ||
      line.term !== root.term ||
      line.studentId !== root.studentId ||
      line.studentName.trim().toLowerCase() !== root.studentName.trim().toLowerCase()
    );
    // Multiple base lines are ALLOWED. They represent a legacy package,
    // not an inconsistent receipt. Mixed void/valid states still flag issues.
    const status = mismatchedIdentity ? "Inconsistent" : getStatus(group);

    receipts.push({
      orNumber: root.orNumber,
      studentName: root.studentName,
      studentNumber: root.studentNumber,
      date: root.date.toISOString(),
      timestamp: root.timestamp.toISOString(),
      academicYear: root.academicYear,
      term: root.term,
      encodedBy: root.encodedBy || "",
      status,
      total: group.reduce((sum, line) => sum + Math.round(line.amountPaid * 100), 0) / 100,
      count: group.length,
      description: [...new Set(group.map(line => line.itemDescription))].join("; ").slice(0, 260),
      categories: [...new Set(group.map(line => line.category).filter(Boolean))],
    });
  }
  return receipts.sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp) || b.orNumber.localeCompare(a.orNumber)
  );
}

export type ReceiptHistoryFilters = {
  academicYear: string;
  term: string;
  search: string;
  exactOr: string;
  category: string;
  from: string;
  to: string;
  status: string;
};

export function filterReceiptHistory(rows: ReceiptHistoryRow[], f: ReceiptHistoryFilters) {
  const q = f.search.trim().toLocaleLowerCase();
  const exactOr = f.exactOr.trim().toUpperCase();
  return rows.filter(row => {
    const date = row.date.slice(0, 10);
    if (f.academicYear && row.academicYear !== f.academicYear) return false;
    if (f.term && row.term !== f.term) return false;
    if (q && ![row.orNumber, row.studentName, row.studentNumber]
      .some(value => value.toLocaleLowerCase().includes(q))) return false;
    if (exactOr && row.orNumber.trim().toUpperCase() !== exactOr) return false;
    if (f.category && !row.categories.includes(f.category)) return false;
    if (f.from && date < f.from) return false;
    if (f.to && date > f.to) return false;
    if (f.status !== "all" && row.status.toLowerCase() !== f.status) return false;
    return true;
  });
}
