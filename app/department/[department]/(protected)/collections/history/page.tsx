import { moneyNumber } from "@/lib/money-precision";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import ReceiptHistoryClient from "./ReceiptHistoryClient";
import { buildIssuedReceipts, filterIssuedReceipts } from "./receipt-grouping";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Issued Receipt History | CLEAR System" };

const get = (v: string | undefined, max: number) => String(v || "").trim().slice(0, max);
const number = (v: string | undefined, fallback: number, max: number) => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 1 ? Math.min(n, max) : fallback;
};
function isoDate(v: string | undefined) {
  const value = get(v, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
    ? value : "";
}

type Search = {
  ay?: string; term?: string; q?: string; or?: string;
  status?: string; category?: string; description?: string;
  paymentType?: string; from?: string; to?: string;
  inconsistentOnly?: string; page?: string; size?: string;
};

export default async function ReceiptHistoryPage({
  params, searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<Search>;
}) {
  const { department } = await params;
  const slug = decodeURIComponent(department).trim().toLowerCase();
  await requireTabAccess("tab-payment", slug);
  const org = await prisma.organization.findUnique({
    where: { subdomain: slug },
    select: { id: true, activeAy: true, activeTerm: true },
  });
  if (!org) return <div className="alert alert-danger">Department not found.</div>;

  const query = searchParams ? await searchParams : {};
  const ay = query.ay === "all" ? "" : get(query.ay, 70) || org.activeAy || "";
  const term = query.term === "all" ? "" : get(query.term, 60) ||
    (query.ay === "all" ? "" : org.activeTerm || "");
  const q = get(query.q, 80);
  const exactOr = get(query.or, 50);
  const status = ["all", "valid", "voided", "inconsistent"].includes(query.status || "")
    ? query.status! : "all";
  const category = get(query.category, 100);
  const description = get(query.description, 120);
  const paymentType = get(query.paymentType, 80);
  const from = isoDate(query.from);
  const to = isoDate(query.to);
  const inconsistentOnly = query.inconsistentOnly === "1";
  const pageSize = [10, 25, 50, 100].includes(Number(query.size)) ? Number(query.size) : 25;
  const requestedPage = number(query.page, 1, 100000);

  // Query only THIS organization's allocation lines, optionally within the
  // requested academic period. Counting raw Collection rows as ORs is wrong:
  // legacy packages repeat the base OR on every line, while newer packages
  // use OR-P02 etc. Group first, filter and paginate issued ORs second.
  //
  // This read-only reconciliation view intentionally never changes balances
  // or emits payment/receipt writes.
  const allocationLines = await prisma.collection.findMany({
    where: {
      organizationId: org.id,
      ...(ay ? { academicYear: ay } : {}),
      ...(term ? { term } : {}),
      // An exact OR lookup needs only its original allocation lines, including
      // legacy repeated ORs and current -P02/-P03 package suffixes. Keep the
      // full-group behavior so anomalies and period collisions stay visible.
      ...(exactOr ? { OR: [
        { orNumber: { equals: exactOr, mode: "insensitive" as const } },
        { orNumber: { startsWith: `${exactOr}-P`, mode: "insensitive" as const } },
      ] } : {}),
    },
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
    select: {
      id: true, orNumber: true, studentId: true, studentName: true,
      student: { select: { studentId: true } },
      academicYear: true, term: true, date: true, timestamp: true,
      encodedBy: true, category: true, itemDescription: true,
      paymentType: true, status: true, amountPaid: true,
    },
  });

  const grouped = buildIssuedReceipts(allocationLines.map(row => ({ ...row, amountPaid: moneyNumber(row.amountPaid) })));
  const categories = [...new Set(grouped.flatMap(r => r.categories))].sort();
  const paymentTypes = [...new Set(grouped.flatMap(r => r.paymentTypes))].sort();
  const matched = filterIssuedReceipts(grouped, {
    q, exactOr, status, category, description, paymentType,
    from, to, inconsistentOnly,
  });
  const total = matched.length;
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, maxPage);
  const receipts = matched.slice((page - 1) * pageSize, page * pageSize);

  return (
    <section className="module card shadow-sm border-secondary p-3 p-md-4">
      <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-3">
        <div>
          <h4 className="text-accent mb-1"><i className="bi bi-receipt me-2"/>Collections Receipt History</h4>
          <div className="small text-muted">
            One row per issued official receipt, including legacy and current package allocations.
          </div>
        </div>
        <Link className="btn btn-outline-secondary btn-sm"
          href={`/department/${encodeURIComponent(slug)}/collections?ay=${encodeURIComponent(ay || org.activeAy || "")}&term=${encodeURIComponent(term || org.activeTerm || "")}`}>
          <i className="bi bi-arrow-left me-1"/>Collections
        </Link>
      </div>
      <ReceiptHistoryClient
        key={JSON.stringify([ay,term,q,exactOr,status,category,description,paymentType,from,to,inconsistentOnly,page,pageSize])}
        department={slug} receipts={receipts} q={q} exactOr={exactOr}
        ay={ay} term={term} statusFilter={status}
        category={category} description={description} paymentType={paymentType}
        from={from} to={to} inconsistentOnly={inconsistentOnly}
        categories={categories} paymentTypes={paymentTypes}
        page={page} pageSize={pageSize} total={total} maxPage={maxPage}
      />
    </section>
  );
}
