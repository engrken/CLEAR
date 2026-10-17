// /app/department/[department]/(protected)/setup/page.tsx

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { requireTabAccess, isSuperAdminEmail } from '@/lib/permissions';
import SetupClient from './SetupClient';
import RestoreForm from './RestoreForm';
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
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();

  await requireTabAccess('tab-setup', cleanDepartment);

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
  });

  if (!organization) {
    return (
      <div className="alert alert-danger p-4 shadow-sm border-secondary">
        <h4 className="fw-bold mb-2">Department Not Found</h4>
        <p className="small mb-0">The department &apos;{decodeURIComponent(department)}&apos; does not exist.</p>
      </div>
    );
  }

  const session = await auth();
  const sessionEmail = String(session?.user?.email || '').trim().toLowerCase();
  let canManageBackups = false;

  if (sessionEmail) {
    if (isSuperAdminEmail(sessionEmail)) {
      canManageBackups = true;
    } else {
      const dbUser = await prisma.tenantUser.findFirst({
        where: {
          organizationId: organization.id,
          email: { equals: sessionEmail, mode: 'insensitive' },
        },
        select: { role: true, status: true },
      });

      const normalizedRole = String(dbUser?.role || '').trim().toLowerCase();
      if (
        dbUser?.status === 'Active' &&
        ['admin', 'administrator', 'master'].includes(normalizedRole)
      ) {
        canManageBackups = true;
      }
    }
  }

  const existingFunds = await prisma.fund.findMany({
    where: { organizationId: organization.id },
    distinct: ['fundName'],
    select: { fundName: true }
  });

  const initialFunds = existingFunds.length > 0
    ? existingFunds.map(f => f.fundName)
    : ["General Fund", "Current Operations", "Others"];

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <SetupClient 
        department={cleanDepartment} 
        organizationId={organization.id} 
        initialFundNames={initialFunds}
        currentLogo={organization.logo}
      />

      {canManageBackups && (
        <>
          {/* EXPORT BACKUP CARD */}
          <div className="card p-3 border-info bg-info bg-opacity-10 shadow-sm mt-4 text-body">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
              <div>
                <h6 className="fw-bold text-info mb-1">
                  <i className="bi bi-cloud-arrow-down-fill me-2"></i>Database Backup &amp; Export
                </h6>
                <small className="text-muted">
                  Download a complete JSON snapshot of your department&apos;s students, collections, funds, audits, and system logs. (Restricted to Active Administrators)
                </small>
              </div>
              <a
                href={`/api/backup?orgId=${encodeURIComponent(organization.id)}`}
                className="btn btn-info fw-bold text-dark d-flex align-items-center gap-2"
                download
              >
                <i className="bi bi-download"></i> Export Full Backup (.json)
              </a>
            </div>
          </div>

          {/* RESTORE BACKUP CARD */}
          <RestoreForm organizationId={organization.id} />
        </>
      )}
    </div>
  );
}