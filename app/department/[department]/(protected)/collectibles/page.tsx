// app/department/[department]/(protected)/collectibles/page.tsx
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import { getPeriodLedger } from "../realign/ledger";
import CollectiblesManager from "./CollectiblesManager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Receivables & Collectibles | CLEAR System",
};

export default async function CollectiblesPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string }>;
}) {
  const { department } = await params;
  let slug: string;
  try {
    slug = decodeURIComponent(department).trim().toLowerCase();
  } catch {
    return <div className="alert alert-danger">Invalid department identifier.</div>;
  }

  await requireTabAccess("tab-collectibles", slug);

  const org = await prisma.organization.findUnique({
    where: { subdomain: slug },
    select: { id: true, activeAy: true, activeTerm: true },
  });
  if (!org) {
    return <div className="alert alert-danger p-4">Department not found.</div>;
  }

  const query = searchParams ? await searchParams : {};
  const ay = String(query.ay || org.activeAy || "A.Y. 2026 - 2027").trim();
  const term = String(query.term || org.activeTerm || "1st Sem").trim();
  const period = { organizationId: org.id, academicYear: ay, term };

  const [students, collectibles, collectionItems, ledger] = await Promise.all([
    prisma.student.findMany({
      where: { organizationId: org.id },
      select: { id: true, studentId: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.collectible.findMany({
      where: period,
      orderBy: { id: "desc" },
    }),
    // Only per-student, standalone fees belong in this form.
    // Mandatory package items already generate package/clearance obligations.
    prisma.collectionSetup.findMany({
      where: { ...period, isPackage: false },
      select: {
        id: true, category: true, name: true,
        amount: true, targetFund: true, isPackage: true,
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
    getPeriodLedger(prisma, org.id, ay, term),
  ]);

  // Current-period receipts may predate explicit assessment linking. Associate
  // them only when exactly one assessment matches student + fee category + name.
  // Cross-period arrears use the authoritative ArrearPaymentLink foreign key.
  const studentByPk = new Map(students.map(s => [s.id, s.studentId.toLowerCase()]));
  const keyFor = (studentId: string, category: string, item: string) =>
    `${studentId.trim().toLowerCase()}\u0000${category.trim().toLowerCase()}\u0000${item.trim().toLowerCase()}`;
  const dueIndex = new Map<string, string[]>();
  for (const due of collectibles) {
    const match = String(due.status).match(/\|SID:([^|]+)\|ITEM:([^|]+)/);
    if (!match) continue;
    try {
      const key = keyFor(decodeURIComponent(match[1]), due.category, decodeURIComponent(match[2]));
      const existing = dueIndex.get(key) || [];
      existing.push(due.id);
      dueIndex.set(key, existing);
    } catch { /* malformed legacy marker: deliberately not matched */ }
  }
  const ambiguousAssessmentIds = new Set<string>();
  for (const ids of dueIndex.values()) {
    if (ids.length > 1) ids.forEach(id => ambiguousAssessmentIds.add(id));
  }
  const originReceiptRows = await prisma.collection.findMany({
    where: period,
    select: {
      id: true, studentId: true, category: true, itemDescription: true,
      orNumber: true, amountPaid: true, date: true, timestamp: true,
      status: true, paymentType: true, encodedBy: true, fundAllocation: true,
      academicYear: true, term: true,
    },
    orderBy: { timestamp: "desc" },
  });
  const linkRows = await prisma.arrearPaymentLink.findMany({
    where: { organizationId: org.id, obligationType: "collectible",
      obligationId: { in: collectibles.map(d => d.id) } },
    select: { obligationId: true, receiptId: true },
  });
  const historicalReceipts = linkRows.length ? await prisma.collection.findMany({
    where: { organizationId: org.id, id: { in: linkRows.map(l => l.receiptId) } },
    select: {
      id: true, studentId: true, category: true, itemDescription: true,
      orNumber: true, amountPaid: true, date: true, timestamp: true,
      status: true, paymentType: true, encodedBy: true, fundAllocation: true,
      academicYear: true, term: true,
    },
  }) : [];
  type ReceiptLine = typeof originReceiptRows[number];
  const historyByAssessment: Record<string, Array<{
    receiptId: string; orNumber: string; amount: number; date: string;
    status: string; paymentType: string; fund: string; officer: string;
    accountingPeriod: string; source: "Same-Period Match" | "Verified Arrears Link";
  }>> = {};
  const addLine = (id: string, receipt: ReceiptLine, source: "Same-Period Match" | "Verified Arrears Link") => {
    const lines = historyByAssessment[id] ||= [];
    if (lines.some(line => line.receiptId === receipt.id)) return;
    lines.push({
      receiptId: receipt.id, orNumber: receipt.orNumber,
      amount: Number(receipt.amountPaid),
      date: receipt.date.toISOString(), status: receipt.status,
      paymentType: receipt.paymentType, fund: receipt.fundAllocation,
      officer: receipt.encodedBy || "—",
      accountingPeriod: `${receipt.term} (${receipt.academicYear})`, source,
    });
  };
  for (const receipt of originReceiptRows) {
    const sid = receipt.studentId ? studentByPk.get(receipt.studentId) : null;
    if (!sid) continue;
    const ids = dueIndex.get(keyFor(sid, receipt.category, receipt.itemDescription)) || [];
    if (ids.length === 1) addLine(ids[0], receipt, "Same-Period Match");
  }
  const linkedReceiptMap = new Map(historicalReceipts.map(r => [r.id, r]));
  for (const link of linkRows) {
    const receipt = linkedReceiptMap.get(link.receiptId);
    if (receipt) addLine(link.obligationId, receipt, "Verified Arrears Link");
  }
  for (const lines of Object.values(historyByAssessment)) {
    lines.sort((a, b) => b.date.localeCompare(a.date));
  }
  // Check Void Center access independently; UI visibility is NOT authorization.
  const canVoidAssessments = await requireTabAccess("tab-void", slug)
    .then(() => true).catch(() => false);

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <h5 className="text-accent mb-3">
        <i className="bi bi-inbox me-2" />Receivables &amp; Collectibles Ledger
      </h5>
      <CollectiblesManager
        department={slug}
        ay={ay}
        term={term}
        students={students}
        collectibles={collectibles}
        collectionItems={collectionItems}
        closed={Boolean(ledger.activeRollover)}
        canVoidAssessments={canVoidAssessments}
        historyByAssessment={historyByAssessment}
        ambiguousAssessmentIds={Array.from(ambiguousAssessmentIds)}
      />
    </div>
  );
}
