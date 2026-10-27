// /app/dashboard/provisions/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/permissions';
import { logoutProvisioningAction } from './actions';
import { MasterProvisionForm } from './MasterProvisionForm';
import { ProvisionRow } from './ProvisionRow';
import { GlobalAdminManager } from './GlobalAdminManager';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function ProvisionsPage() {
  // Email matching alone is insufficient; the shared guard checks signed-in role + email.
  let email = '';
  try {
    const actor = await requireSuperAdmin();
    email = String(actor.email || '').trim().toLowerCase();
  } catch {
    redirect('/dashboard');
  }

  const [additionalAdmins, globalAdminAudit] = await Promise.all([
    prisma.globalSuperAdmin.findMany({ orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, fullName: true, status: true, invitedBy: true,
        invitationExpiresAt: true, lastLoginAt: true, activatedAt: true, createdAt: true } }),
    prisma.globalAdminAudit.findMany({ orderBy: { createdAt: 'desc' }, take: 30,
      select: { id: true, actorEmail: true, targetEmail: true, action: true, createdAt: true } }),
  ]);

  const organizations = await prisma.organization.findMany({
    orderBy: [{ schoolGroup: 'asc' }, { name: 'asc' }],
    include: {
      _count: {
        select: { students: true, collections: true, tenantUsers: true },
      },
    },
  });

  return (
    <div className="container-fluid p-4 p-md-5" style={{ maxWidth: '1300px', color: '#f8fafc' }}>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div className="d-flex align-items-center gap-3">
          <Link href="/dashboard" className="text-secondary small text-decoration-none">
            <i className="bi bi-arrow-left me-1" />Back to Main Dashboard
          </Link>
          <Link href="/dashboard/entity/portal" className="text-info small text-decoration-none fw-bold">
            <i className="bi bi-building-fill-gear me-1" />Entity Admin Portal
          </Link>
          <Link href="/dashboard/provisions/maintenance" className="text-warning small text-decoration-none fw-bold">
            <i className="bi bi-tools me-1" />Maintenance Control &amp; Notice Board
          </Link>
        </div>
        <div className="d-flex align-items-center gap-3">
          <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-3 py-2">
            <i className="bi bi-shield-check me-1" />Master SuperAdmin: {email}
          </span>
          <form action={logoutProvisioningAction}>
            <button type="submit" className="btn btn-sm btn-outline-secondary">
              <i className="bi bi-box-arrow-right me-1" />Sign Out
            </button>
          </form>
        </div>
      </div>

      <div className="p-4 rounded-4 shadow-lg border border-secondary border-opacity-50 mb-4" style={{ backgroundColor: '#1e293b' }}>
        <h1 className="h3 fw-bold text-white mb-1">SaaS Institutional Provisioning &amp; Tiers</h1>
        <p className="text-secondary small mb-0">
          Manage multi-tenant school groups, enforce Freemium and Pro limits, and provision entities with initial administrators.
        </p>
      </div>

      <GlobalAdminManager accounts={additionalAdmins} audit={globalAdminAudit} actorEmail={email} />
      <div className="row g-4">
        <div className="col-12 col-lg-4">
          <div className="p-4 rounded-4 shadow-lg border border-secondary border-opacity-50 h-100" style={{ backgroundColor: '#1e293b' }}>
            <h5 className="fw-bold text-white border-bottom border-secondary pb-3 mb-3">Provision New Tenant</h5>
            <MasterProvisionForm />
          </div>
        </div>
        <div className="col-12 col-lg-8">
          <div className="p-4 rounded-4 shadow-lg border border-secondary border-opacity-50 h-100" style={{ backgroundColor: '#1e293b' }}>
            <h5 className="fw-bold text-white border-bottom border-secondary pb-3 mb-3">
              Registered Tenants ({organizations.length})
            </h5>
            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle mb-0 text-start" style={{ backgroundColor: 'transparent' }}>
                <thead>
                  <tr className="text-secondary small text-uppercase border-bottom border-secondary">
                    <th className="py-3">School Group / Tenant</th>
                    <th className="py-3">Tier</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Stats</th>
                    <th className="py-3 text-end">Actions</th>
                  </tr>
                </thead>
                <tbody className="border-top-0">
                  {organizations.map((org) => <ProvisionRow key={org.id} org={org} />)}
                  {organizations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-5 text-center text-secondary">No organizations provisioned yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-secondary small mt-3 mb-0">
              Permanent deletion is permitted only for unused tenants. Archive organizations that have financial or student records.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
