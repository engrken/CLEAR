import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import AdvancesForm from "./AdvancesForm";
import CashAdvanceHistory from "./CashAdvanceHistory";
import { getPeriodLedger } from "../realign/ledger";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Centralized Liquidation of Expenses & Audit Records",
};
export const dynamic = "force-dynamic";

export default async function CashAdvancesPage({ params, searchParams }: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string }>;
}) {
  const { department } = await params;
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();
  await requireTabAccess("tab-advances", cleanDepartment);
  const search = searchParams ? await searchParams : {};
  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
    select: { id: true, activeAy: true, activeTerm: true },
  });
  if (!organization) return <div className="alert alert-danger p-4">Department Not Found</div>;
  const ay = search.ay || organization.activeAy || "A.Y. 2026 - 2027";
  const term = search.term || organization.activeTerm || "1st Sem";
  let canVoid = false;
  try { await requireTabAccess("tab-void", cleanDepartment); canVoid = true; } catch { /* permission absent */ }
  const [students, ledger, advances] = await Promise.all([
    prisma.student.findMany({
      where: { organizationId: organization.id },
      select: { studentId: true, fullName: true },
      orderBy: { fullName: "asc" },
    }),
    getPeriodLedger(prisma, organization.id, ay, term),
    prisma.cashAdvance.findMany({ where: { organizationId: organization.id, academicYear: ay, term },
      orderBy: { dateIssued: "desc" }, take: 3000 }),
  ]);
  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <h5 className="text-accent mb-3"><i className="bi bi-journal-arrow-up me-2" />Cash Advance Register</h5>
      {ledger.activeRollover && <div className="alert alert-warning">This period has been carried forward. New cash advances are locked until the rollover is reversed.</div>}
      <AdvancesForm department={cleanDepartment} ay={ay} term={term}
        students={students} funds={ledger.funds} closed={Boolean(ledger.activeRollover)} />
      <CashAdvanceHistory department={cleanDepartment} ay={ay} term={term}
        advances={JSON.parse(JSON.stringify(advances))}
        canVoid={canVoid} closed={Boolean(ledger.activeRollover)} />
    </div>
  );
}
