// /app/department/[department]/(protected)/cashier-remittance/page.tsx

import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
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
        department={cleanDepartment} 
        ay={ay} 
        term={term} 
        funds={funds} 
        remittances={remittances} 
      />
    </div>
  );
}