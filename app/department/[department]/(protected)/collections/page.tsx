// /app/department/[department]/(protected)/collections/page.tsx

import { prisma } from "@/lib/prisma";
import { requireTabAccess } from "@/lib/permissions";
import CollectionsForm from "./CollectionsForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Centralized Liquidation of Expenses & Audit Records",
};

export default async function CollectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{
    ay?: string;
    term?: string;
    prefillId?: string;
    penaltyId?: string;
    prefillCategory?: string;
    prefillDesc?: string;
    prefillAmount?: string;
  }>;
}) {
  const { department } = await params;
  const cleanDepartment = decodeURIComponent(department).toLowerCase().trim();

  // 🚀 SECURITY FIX: Enforce tab-level permissions for collections access
  await requireTabAccess('tab-payment', cleanDepartment);

  const resolvedSearch = searchParams ? await searchParams : {};
  const prefillId = resolvedSearch.prefillId || "";
  const penaltyId = resolvedSearch.penaltyId || "";
  const prefillCategory = resolvedSearch.prefillCategory || "";
  const prefillDesc = resolvedSearch.prefillDesc || "";
  const prefillAmount = resolvedSearch.prefillAmount || "";

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
    select: {
      id: true,
      name: true,
      activeAy: true,
      activeTerm: true,
    }
  });

  if (!organization) {
    return (
      <div className="alert alert-danger p-4 shadow-sm border-secondary">
        <h4 className="fw-bold mb-2">Department Not Found</h4>
        <p className="small mb-0">The department '{decodeURIComponent(department)}' does not exist.</p>
      </div>
    );
  }

  // 🚀 Dynamically link academic year and term to organization database defaults
  const ay = resolvedSearch.ay || organization.activeAy || "A.Y. 2026 - 2027";
  const term = resolvedSearch.term || organization.activeTerm || "1st Sem";

  const students = await prisma.student.findMany({
    where: { organizationId: organization.id },
    select: { studentId: true, fullName: true, email: true },
    orderBy: { fullName: "asc" },
  });

  const funds = await prisma.fund.findMany({
    where: { organizationId: organization.id, academicYear: ay, term },
    orderBy: { fundName: "asc" },
  });

  const collectionSetups = await prisma.collectionSetup.findMany({
    where: { organizationId: organization.id, academicYear: ay, term },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  const lastCollection = await prisma.collection.findFirst({
    where: { organizationId: organization.id, academicYear: ay },
    orderBy: { timestamp: "desc" },
    select: { orNumber: true, paymentType: true },
  });

  const match = ay.match(/\d{4}/);
  const yearPrefix = match ? match[0].slice(-2) : "26";
  let nextOr = `${yearPrefix}-001`;

  if (lastCollection && lastCollection.orNumber) {
    const lastOr = lastCollection.orNumber.toUpperCase();
    if (!lastOr.includes("VOID") && !lastOr.includes("DUE-") && !lastOr.includes("CO-")) {
      const parts = lastOr.split("-");
      if (parts.length > 1) {
        const numPart = parseInt(parts[1].replace(/[^0-9]/g, ""), 10);
        if (!isNaN(numPart)) {
          const nextNum = numPart + 1;
          nextOr = `${parts[0]}-${nextNum < 1000 ? String(nextNum).padStart(3, "0") : nextNum}`;
        }
      }
    }
  }

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <h5 className="text-accent mb-3">
        <i className="bi bi-cash-stack me-2"></i> Collection Remittance
      </h5>
      <CollectionsForm
        department={cleanDepartment}
        ay={ay}
        term={term}
        students={students}
        funds={funds}
        collectionItems={collectionSetups}
        nextOr={nextOr}
        prefillId={prefillId}
        penaltyId={penaltyId}
        prefillCategory={prefillCategory}
        prefillDesc={prefillDesc}
        prefillAmount={prefillAmount}
      />
    </div>
  );
}