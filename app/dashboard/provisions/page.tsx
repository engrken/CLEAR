// /app/dashboard/provisions/page.tsx
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { isSuperAdminEmail } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ProvisionRow } from './ProvisionRow';
import { MasterProvisionForm } from './MasterProvisionForm';
import { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function ProvisionsPage() {
  const session = await auth();
  const email = String(session?.user?.email || '').trim().toLowerCase();

  if (!email || !isSuperAdminEmail(email)) {
    redirect('/dashboard');
  }

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
      {/* Top Navigation */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <Link href="/dashboard" className="text-secondary small text-decoration-none">
          <i className="bi bi-arrow-left me-1"></i> Back to Main Dashboard
        </Link>
        <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-3 py-2">
          <i className="bi bi-shield-check me-1"></i> Master SuperAdmin: {email}
        </span>
      </div>

      {/* Header */}
      <div
        className="p-4 rounded-4 shadow-lg border border-secondary border-opacity-50 mb-4"
        style={{ backgroundColor: '#1e293b' }}
      >
        <h1 className="h3 fw-bold text-white mb-1">SaaS Institutional Provisioning & Tiers</h1>
        <p className="text-secondary small mb-0">
          Manage multi-tenant school groups, monitor tier limits (Freemium vs. Pro vs. Corporate), and provision new entities with initial administrators.
        </p>
      </div>

      {/* Main Grid */}
      <div className="row g-4">
        {/* Left Column: Provision New Tenant Form */}
        <div className="col-12 col-lg-4">
          <div
            className="p-4 rounded-4 shadow-lg border border-secondary border-opacity-50 h-100"
            style={{ backgroundColor: '#1e293b' }}
          >
            <h5 className="fw-bold text-white border-bottom border-secondary pb-3 mb-3">
              Provision New Tenant
            </h5>
            <MasterProvisionForm />
          </div>
        </div>

        {/* Right Column: Existing Tenants Matrix */}
        <div className="col-12 col-lg-8">
          <div
            className="p-4 rounded-4 shadow-lg border border-secondary border-opacity-50 h-100"
            style={{ backgroundColor: '#1e293b' }}
          >
            <h5 className="fw-bold text-white border-bottom border-secondary pb-3 mb-3">
              Registered Tenants ({organizations.length})
            </h5>

            <div className="table-responsive">
              <table
                className="table table-dark table-hover align-middle mb-0 text-start"
                style={{ backgroundColor: 'transparent' }}
              >
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
                  {organizations.map((org) => (
                    <ProvisionRow key={org.id} org={org} />
                  ))}
                  {organizations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-5 text-center text-secondary">
                        No organizations provisioned yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}