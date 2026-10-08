import { prisma } from '@/lib/prisma';
import SetupClient from './SetupClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function SetupPage({
  params,
}: {
  params: Promise<{ department: string }>;
}) {
  const { department } = await params;

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department },
  });

  if (!organization) {
    return (
      <div className="alert alert-danger p-4 shadow-sm border-secondary">
        <h4 className="fw-bold mb-2">Department Not Found</h4>
        <p className="small mb-0">The department '{decodeURIComponent(department)}' does not exist.</p>
      </div>
    );
  }

  // Fetch distinct fund names previously used by this department
  const existingFunds = await prisma.fund.findMany({
    where: { organizationId: organization.id },
    distinct: ['fundName'],
    select: { fundName: true }
  });

  // Provide a generic fallback if the department is brand new
  const initialFunds = existingFunds.length > 0
    ? existingFunds.map(f => f.fundName)
    : ["General Fund", "Current Operations", "Others"];

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <SetupClient 
        department={department} 
        organizationId={organization.id} 
        initialFundNames={initialFunds} 
      />
    </div>
  );
}