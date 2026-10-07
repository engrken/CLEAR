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

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <SetupClient department={department} organizationId={organization.id} />
    </div>
  );
}