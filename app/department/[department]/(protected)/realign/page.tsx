// /app/department/[department]/(protected)/realign/page.tsx

import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import RealignManager from './RealignManager';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function RealignPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string }>;
}) {
  const { department } = await params;
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();

  // 🚀 SECURITY FIX: Enforce tab-level permissions for fund realignment access
  await requireTabAccess('tab-setup', cleanDepartment);

  const resolvedSearch = searchParams ? await searchParams : {};

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
    select: {
      id: true,
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
  const ay = resolvedSearch.ay || organization.activeAy || 'A.Y. 2026 - 2027';
  const term = resolvedSearch.term || organization.activeTerm || '1st Sem';

  const [collections, audits, cashAdvances, initialFunds, fundTransfers] = await Promise.all([
    prisma.collection.findMany({ where: { organizationId: organization.id, academicYear: ay, term } }),
    prisma.audit.findMany({ where: { organizationId: organization.id, academicYear: ay, term } }),
    prisma.cashAdvance.findMany({ where: { organizationId: organization.id, academicYear: ay, term } }),
    prisma.fund.findMany({ where: { organizationId: organization.id, academicYear: ay, term } }),
    (prisma as any).fundTransfer ? (prisma as any).fundTransfer.findMany({ where: { organizationId: organization.id, academicYear: ay, term } }) : []
  ]);

  const getFundName = (row: any) => {
    const raw = String(row.fundAllocation || row.fundSource || row.fundName || row.fund || '').trim();
    return (raw === '' || raw === 'undefined' || raw === 'null') ? 'General Fund (Carried Over)' : raw;
  };

  const collectionsByFund: Record<string, number> = {};
  collections.forEach(c => {
    if (!String((c as any).paymentType || '').toUpperCase().includes('VOID')) {
      const fund = getFundName(c);
      collectionsByFund[fund] = (collectionsByFund[fund] || 0) + (Number((c as any).amountPaid) || 0);
    }
  });

  const expensesByFund: Record<string, number> = {};
  audits.forEach(a => {
    const status = String((a as any).status || '').toUpperCase();
    if (!status.includes('VOID') && !status.includes('CANCEL')) {
      const fund = getFundName(a);
      expensesByFund[fund] = (expensesByFund[fund] || 0) + (Number((a as any).totalExpense) || 0);
    }
  });

  const unliquidatedByFund: Record<string, number> = {};
  cashAdvances.forEach(ca => {
    const status = String((ca as any).status || '').toUpperCase();
    if (status.includes('PENDING') && !status.includes('CANCEL')) {
      const fund = getFundName(ca);
      unliquidatedByFund[fund] = (unliquidatedByFund[fund] || 0) + (Number((ca as any).amountApproved) || Number((ca as any).amount) || 0);
    }
  });

  const transferNet: Record<string, number> = {};
  fundTransfers.forEach((t: any) => {
    const amt = Number(t.amount) || 0;
    const fromF = String(t.sourceFund || t.fromFund || '').trim();
    const toF = String(t.destinationFund || t.toFund || '').trim();
    if (fromF) transferNet[fromF] = (transferNet[fromF] || 0) - amt;
    if (toF) transferNet[toF] = (transferNet[toF] || 0) + amt;
  });

  const initialAllocMap: Record<string, number> = {};
  initialFunds.forEach(f => {
    if (f.fundName) {
      initialAllocMap[f.fundName] = Number(f.initialAllocation) || 0;
    }
  });

  const allFundNames = Array.from(new Set([
    ...Object.keys(collectionsByFund), ...Object.keys(expensesByFund),
    ...Object.keys(unliquidatedByFund), ...Object.keys(initialAllocMap), ...Object.keys(transferNet)
  ])).sort((a, b) => a.localeCompare(b));

  const fundsList = allFundNames.map(name => {
    const balance = (initialAllocMap[name] || 0) + (collectionsByFund[name] || 0) - (expensesByFund[name] || 0) - (unliquidatedByFund[name] || 0) + (transferNet[name] || 0);
    return { name, balance };
  });

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <h5 className="text-accent mb-3"><i className="bi bi-arrow-left-right me-2"></i>Fund Realignments & Carry-Over</h5>
      <RealignManager 
        department={cleanDepartment}
        ay={ay}
        term={term}
        funds={fundsList}
      />
    </div>
  );
}