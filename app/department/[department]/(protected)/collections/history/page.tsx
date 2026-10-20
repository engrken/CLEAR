import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import { buildReceiptHistoryRows, filterReceiptHistory } from "@/lib/receipt-history-grouping";
import ReceiptHistoryClient from "./ReceiptHistoryClient";
import { receiptStatus } from "./receipt-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Issued Receipt History | CLEAR System" };
const get = (v: string | undefined, max: number) => String(v || "").trim().slice(0, max);
const number = (v: string | undefined, fallback: number, max: number) => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 1 ? Math.min(n, max) : fallback;
};
const isoDate = (value: string | undefined) => {
  const v = get(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : "";
};

export default async function ReceiptHistoryPage({
  params, searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{
    ay?: string; term?: string; q?: string; status?: string;
    page?: string; size?: string; exactOr?: string; category?: string;
    from?: string; to?: string;
  }>;
}) {
  const { department } = await params;
  const slug = decodeURIComponent(department).trim().toLowerCase();
  await requireTabAccess("tab-payment", slug);
  const org = await prisma.organization.findUnique({
    where: { subdomain: slug },
    select: { id: true, name: true, activeAy: true, activeTerm: true },
  });
  if (!org) return <div className="alert alert-danger">Department not found.</div>;

  const query = searchParams ? await searchParams : {};
  const ay = query.ay === "all" ? "" : get(query.ay, 70) || org.activeAy || "";
  const term = query.term === "all" ? "" : get(query.term, 60) ||
    (query.ay === "all" ? "" : org.activeTerm || "");
  const q = get(query.q, 80);
  const exactOr = get(query.exactOr, 50);
  const category = get(query.category, 100);
  const from = isoDate(query.from);
  const to = isoDate(query.to);
  const status = ["all", "valid", "voided", "inconsistent"].includes(query.status || "")
    ? query.status! : "all";
  const pageSize = [10, 25, 50, 100].includes(Number(query.size)) ? Number(query.size) : 25;
  const requestedPage = number(query.page, 1, 100000);

  // Legacy packages saved 4 lines under the SAME base OR. Modern package
  // lines may have OR-P02, OR-P03 suffixes. Group first, then paginate
  // receipt identities: counting Collection rows duplicates legacy packages.
  // Read-only tenant-scoped query; no receipts, balances or statuses are updated.
  const lines = await prisma.collection.findMany({
    where: { organizationId: org.id },
    select: {
      orNumber: true, studentName: true, studentId: true,
      student: { select: { studentId: true } },
      date: true, timestamp: true, academicYear: true, term: true,
      encodedBy: true, category: true, itemDescription: true,
      amountPaid: true, status: true, paymentType: true,
    },
  });

  const allReceipts = buildReceiptHistoryRows(
    lines.map(line => ({ ...line, studentNumber: line.student?.studentId || "" })),
    receiptStatus,
  );
  const categories = [...new Set(lines.map(line => line.category).filter(Boolean))].sort();
  const filteredReceipts = filterReceiptHistory(allReceipts, {
    academicYear: ay, term, search: q, exactOr, category, from, to, status,
  });
  const total = filteredReceipts.length;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, maxPage);
  const receipts = filteredReceipts.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className="module card shadow-sm border-secondary p-3 p-md-4">
      <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-3">
        <div>
          <h4 className="text-accent mb-1"><i className="bi bi-receipt me-2"/>Collections Receipt History</h4>
          <div className="small text-muted">One row per issued OR, including legacy package allocations and voided receipts.</div>
        </div>
        <Link className="btn btn-outline-secondary btn-sm" href={`/department/${encodeURIComponent(slug)}/collections?ay=${encodeURIComponent(ay || org.activeAy || "")}&term=${encodeURIComponent(term || org.activeTerm || "")}`}>
          <i className="bi bi-arrow-left me-1"/>Collections
        </Link>
      </div>
      <ReceiptHistoryClient department={slug} receipts={receipts} q={q}
        exactOr={exactOr} category={category} from={from} to={to}
        categories={categories} ay={ay} term={term} statusFilter={status}
        page={page} pageSize={pageSize} total={total} maxPage={maxPage} />
    </section>
  );
}
