import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import ReceiptHistoryClient from "./ReceiptHistoryClient";
import { receiptStatus } from "./receipt-data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Issued Receipt History | CLEAR System" };
const get = (v: string | undefined, max: number) => String(v || "").trim().slice(0, max);
const number = (v: string | undefined, fallback: number, max: number) => {
  const n = Number(v);
  return Number.isSafeInteger(n) && n >= 1 ? Math.min(n, max) : fallback;
};

export default async function ReceiptHistoryPage({
  params, searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string; q?: string; status?: string; page?: string; size?: string }>;
}) {
  const { department } = await params;
  const slug = decodeURIComponent(department).trim().toLowerCase();
  await requireTabAccess("tab-payment", slug);
  const org = await prisma.organization.findUnique({ where: { subdomain: slug },
    select: { id: true, name: true, activeAy: true, activeTerm: true } });
  if (!org) return <div className="alert alert-danger">Department not found.</div>;

  const query = searchParams ? await searchParams : {};
  // Blank period means all periods; default to the active period only on first visit.
  const ay = query.ay === "all" ? "" : get(query.ay, 70) || org.activeAy || "";
  const term = query.term === "all" ? "" : get(query.term, 60) || (query.ay === "all" ? "" : org.activeTerm || "");
  const q = get(query.q, 80);
  const status = ["all", "valid", "voided"].includes(query.status || "") ? query.status! : "all";
  const pageSize = [10, 25, 50, 100].includes(Number(query.size)) ? Number(query.size) : 25;
  const requestedPage = number(query.page, 1, 100000);

  // Each issued receipt has one base OR (other package lines use -P##).
  // This query deliberately counts ORs, rather than individual fund splits.
  // Prisma 5.22: case-insensitive string filters belong at this level, not
  // inside StringFilter.not (NestedStringFilter has no `mode` property).
  const voidedFilters: Prisma.CollectionWhereInput[] = ["Void", "Cancel", "Reject"].flatMap((word) => [
    { status: { contains: word, mode: "insensitive" as const } },
    { paymentType: { contains: word, mode: "insensitive" as const } },
  ]);
  const excludedFilters: Prisma.CollectionWhereInput[] = [
    { orNumber: { contains: "-P", mode: "insensitive" } },
  ];
  if (status === "valid") excludedFilters.push({ OR: voidedFilters });
  const where: Prisma.CollectionWhereInput = {
    organizationId: org.id,
    NOT: excludedFilters,
    ...(ay ? { academicYear: ay } : {}),
    ...(term ? { term } : {}),
    ...(status === "voided" ? { OR: voidedFilters } : {}),
    ...(q ? { AND: [{ OR: [
      { orNumber: { contains: q, mode: "insensitive" } },
      { studentName: { contains: q, mode: "insensitive" } },
      { student: { is: { studentId: { contains: q, mode: "insensitive" } } } },
    ] }] } : {}),
  };
  const total = await prisma.collection.count({ where });
  const maxPage = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, maxPage);
  const anchors = await prisma.collection.findMany({ where,
    orderBy: [{ timestamp: "desc" }, { id: "desc" }],
    skip: (page - 1) * pageSize, take: pageSize,
    select: { orNumber: true, studentName: true, date: true, timestamp: true,
      academicYear: true, term: true, encodedBy: true, student: { select: { studentId: true } } },
  });
  const bases = anchors.map((r) => r.orNumber);
  const lines = bases.length ? await prisma.collection.findMany({ where: {
    organizationId: org.id, OR: bases.flatMap((orNumber) => [
      { orNumber }, { orNumber: { startsWith: `${orNumber}-P` } },
    ]),
  }, select: { orNumber: true, category: true, itemDescription: true,
    amountPaid: true, status: true, paymentType: true, fundAllocation: true,
    studentId: true, academicYear: true, term: true } }) : [];
  const receipts = anchors.map((root) => {
    const group = lines.filter((line) => line.orNumber.toUpperCase() === root.orNumber.toUpperCase() ||
      new RegExp(`^${root.orNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-P\\d+$`, "i").test(line.orNumber));
    const inconsistent = group.filter(line => line.orNumber.toUpperCase() === root.orNumber.toUpperCase()).length !== 1 ||
      group.some(line => line.academicYear !== root.academicYear || line.term !== root.term);
    return {
      orNumber: root.orNumber,
      studentName: root.studentName,
      studentNumber: root.student?.studentId || "",
      date: root.date.toISOString(), timestamp: root.timestamp.toISOString(),
      academicYear: root.academicYear, term: root.term,
      encodedBy: root.encodedBy || "",
      status: inconsistent ? "Inconsistent" : receiptStatus(group),
      total: group.reduce((sum, line) => sum + Math.round(line.amountPaid * 100), 0) / 100,
      count: group.length,
      description: group.map(line => line.itemDescription).join("; ").slice(0, 260),
    };
  });
  return (
    <section className="module card shadow-sm border-secondary p-3 p-md-4">
      <div className="d-flex align-items-center justify-content-between gap-2 flex-wrap mb-3">
        <div>
          <h4 className="text-accent mb-1"><i className="bi bi-receipt me-2"/>Collections Receipt History</h4>
          <div className="small text-muted">One row per issued OR, including package splits and voided receipts.</div>
        </div>
        <Link className="btn btn-outline-secondary btn-sm" href={`/department/${encodeURIComponent(slug)}/collections?ay=${encodeURIComponent(ay || org.activeAy || "")}&term=${encodeURIComponent(term || org.activeTerm || "")}`}>
          <i className="bi bi-arrow-left me-1"/>Collections
        </Link>
      </div>
      <ReceiptHistoryClient department={slug} receipts={receipts} q={q} ay={ay}
        term={term} statusFilter={status} page={page} pageSize={pageSize}
        total={total} maxPage={maxPage} />
    </section>
  );
}
