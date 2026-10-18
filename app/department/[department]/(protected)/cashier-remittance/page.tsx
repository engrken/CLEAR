// /app/department/[department]/(protected)/cashier-remittance/page.tsx

import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import CashierRemittanceForm from "./CashierRemittanceForm";
import { Metadata } from "next";
import { getCashierPosition, getPeriodLedger } from "../realign/ledger";

export const metadata: Metadata = {
  title: "University Cashier Deposit | CLEAR System",
};

export default async function CashierRemittancePage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string; }>;
}) {
  const { department } = await params;
  const cleanDepartment = decodeURIComponent(department).toLowerCase().trim();

  // 🚀 SECURITY FIX: Enforce tab-level permissions for cashier deposit access
  await requireTabAccess('tab-payment', cleanDepartment);

  const resolvedSearch = searchParams ? await searchParams : {};

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
  });

  if (!organization) {
    return (
      <div className="alert alert-danger p-4 shadow-sm border-secondary">
        <h4 className="fw-bold mb-2">Department Not Found</h4>
      </div>
    );
  }

  // 🚀 Dynamically link academic year and term to organization database defaults
  const ay = resolvedSearch.ay || organization.activeAy || "A.Y. 2026 - 2027";
  const term = resolvedSearch.term || organization.activeTerm || "1st Sem";

  // Include dynamically created/realigned pools, not only initial Fund rows.
  const ledger = await getPeriodLedger(prisma, organization.id, ay, term);
  const custody = await getCashierPosition(prisma, organization.id, ay, term);
  const funds = ledger.funds.map((fund) => ({
    id: fund.name,
    fundName: fund.name,
    availablePhysical: Math.max(0, fund.balance - (custody.balancesByFund[fund.name] ?? 0)),
    heldByCashier: Math.max(0, custody.balancesByFund[fund.name] ?? 0),
  }));
  const legacyPooledHeld = Math.max(0, custody.balancesByFund["Remaining Balance (Net Ending Position)"] ?? 0);

  const remittances = await prisma.cashierRemittance.findMany({
    where: { organizationId: organization.id, academicYear: ay, term },
    orderBy: { date: "desc" },
  });

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <h5 className="text-accent mb-3">
        <i className="bi bi-safe me-2"></i> University Cashier Safekeeping
      </h5>
      <CashierRemittanceForm 
        department={cleanDepartment} 
        ay={ay} 
        term={term} 
        funds={funds} 
        remittances={remittances}
        orgName={organization.name}
        reportSchoolName={organization.reportSchoolName ?? ''}
        reportSchoolAddress={organization.reportSchoolAddress ?? ''}
        cashierBalance={ledger.cashierBalance}
        legacyPooledHeld={legacyPooledHeld}
        availableCash={ledger.totalRemaining - ledger.cashierBalance}
        periodClosed={Boolean(ledger.activeRollover)} 
      />
    </div>
  );
}