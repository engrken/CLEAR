// /app/department/[department]/(protected)/cashier-remittance/page.tsx

import { prisma } from "@/lib/prisma";
import CashierRemittanceForm from "./CashierRemittanceForm";
import { Metadata } from "next";

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
  const resolvedSearch = searchParams ? await searchParams : {};

  const ay = resolvedSearch.ay || "A.Y. 2026 - 2027";
  const term = resolvedSearch.term || "1st Sem";

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department },
  });

  if (!organization) {
    return (
      <div className="alert alert-danger p-4 shadow-sm border-secondary">
        <h4 className="fw-bold mb-2">Department Not Found</h4>
      </div>
    );
  }

  const funds = await prisma.fund.findMany({
    where: { organizationId: organization.id, academicYear: ay, term },
    orderBy: { fundName: "asc" },
  });

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
        department={department} 
        ay={ay} 
        term={term} 
        funds={funds} 
        remittances={remittances} 
      />
    </div>
  );
}