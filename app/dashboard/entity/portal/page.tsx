// /app/dashboard/entity/portal/page.tsx
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAuthenticatedEntityAdmin, logoutEntityAdminAction } from '../actions';
import { EntityProvisionForm } from './EntityProvisionForm';

export default async function EntityPortalPage() {
  const session = await auth();
  const cookieEmail = await getAuthenticatedEntityAdmin();

  const email = String(cookieEmail || session?.user?.email || '')
    .trim()
    .toLowerCase();

  if (!email) {
    redirect('/dashboard/entity/login');
  }

  // Find all organizations where this user is registered as an admin
  const userAdminRecords = await prisma.tenantUser.findMany({
    where: { email, role: 'admin' },
    include: { organization: true },
  });

  if (userAdminRecords.length === 0) {
    redirect('/dashboard/entity/login');
  }

  const primaryOrg = userAdminRecords[0].organization;
  const schoolGroup = primaryOrg.schoolGroup || 'default-school';

  // SECURITY SAFEGUARD: If schoolGroup is still 'default-school', only show entities
  // explicitly administered by this user's email so unrelated demo tenants aren't leaked.
  const entityGroupOrgs = await prisma.organization.findMany({
    where:
      schoolGroup === 'default-school'
        ? { id: { in: userAdminRecords.map((r) => r.organizationId) } }
        : { schoolGroup },
    orderBy: { name: 'asc' },
    include: {
      _count: {
        select: { students: true, collections: true, tenantUsers: true },
      },
    },
  });

  const currentTier = primaryOrg.tier || 'Freemium';
  const maxAllowed = currentTier === 'Freemium' ? 2 : currentTier === 'Pro' ? 10 : 999;
  const canAddMore = entityGroupOrgs.length < maxAllowed;

  return (
    <div className="container py-5 text-white" style={{ maxWidth: '1100px' }}>
      {/* Top Bar Navigation */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <Link href="/dashboard" className="text-secondary small text-decoration-none">
          <i className="bi bi-arrow-left me-1"></i> Back to Public Entity Directory
        </Link>
        <div className="d-flex align-items-center gap-3">
          <span className="text-secondary small font-monospace">
            <i className="bi bi-person-check-fill text-info me-1"></i>
            {email}
          </span>
          <form action={logoutEntityAdminAction}>
            <button type="submit" className="btn btn-sm btn-outline-secondary">
              <i className="bi bi-box-arrow-right me-1"></i> Sign Out
            </button>
          </form>
        </div>
      </div>

      {/* Header Banner */}
      <div className="card bg-dark border-secondary p-4 mb-4 shadow-sm">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <span className="badge bg-info text-dark mb-2 fw-bold text-uppercase">
              Institutional Group: {schoolGroup}
            </span>
            <h2 className="fw-bold mb-1 text-white">Entity Management Portal</h2>
            <p className="text-secondary small mb-0">
              Self-service institutional onboarding and workspace management for your affiliated entities.
            </p>
          </div>
          <div className="text-end bg-secondary bg-opacity-10 border border-secondary p-3 rounded">
            <div className="small text-secondary text-uppercase fw-bold">Subscription Tier</div>
            <div className="fs-5 fw-bold text-info">{currentTier}</div>
            <div className="small text-secondary">
              {entityGroupOrgs.length} / {maxAllowed === 999 ? 'Unlimited' : maxAllowed} Entities Active
            </div>
          </div>
        </div>
      </div>

      {!canAddMore && (
        <div className="alert alert-warning border-0 shadow-sm mb-4">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          You have reached the maximum limit of <strong>{maxAllowed}</strong> entities for your{' '}
          <strong>{currentTier}</strong> subscription tier. Contact the System SuperAdmin to upgrade your institutional group to Pro or Corporate.
        </div>
      )}

      <div className="row g-4">
        {/* Left Column: Self-Service Provision Form */}
        <div className="col-12 col-lg-4">
          <div className="card bg-dark border-secondary p-4 shadow-sm h-100">
            <h5 className="fw-bold text-white border-bottom border-secondary pb-3 mb-3">
              Add New Entity Workspace
            </h5>
            <EntityProvisionForm
              schoolGroup={schoolGroup}
              currentTier={currentTier}
              canAddMore={canAddMore}
            />
          </div>
        </div>

        {/* Right Column: Entity List Table */}
        <div className="col-12 col-lg-8">
          <div className="card bg-dark border-secondary p-4 shadow-sm h-100">
            <h5 className="fw-bold text-white border-bottom border-secondary pb-3 mb-3">
              Your Managed Entities ({entityGroupOrgs.length})
            </h5>

            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle text-start mb-0">
                <thead>
                  <tr className="text-secondary small text-uppercase">
                    <th>Entity / Subdomain</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Records</th>
                    <th className="text-end">Workspace</th>
                  </tr>
                </thead>
                <tbody>
                  {entityGroupOrgs.map((org) => (
                    <tr key={org.id}>
                      <td>
                        <div className="fw-bold text-white">{org.name}</div>
                        <div className="small text-info font-monospace">/department/{org.subdomain}</div>
                      </td>
                      <td>
                        <span className="badge bg-secondary text-light">{org.type || 'Department'}</span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            org.status === 'Active' ? 'bg-success' : 'bg-danger'
                          }`}
                        >
                          {org.status}
                        </span>
                      </td>
                      <td className="small text-secondary">
                        <div>{org._count.students} Students</div>
                        <div>{org._count.collections} Collections</div>
                      </td>
                      <td className="text-end">
                        <Link
                          href={`/department/${org.subdomain}`}
                          className="btn btn-sm btn-outline-info fw-semibold"
                        >
                          Open Portal <i className="bi bi-box-arrow-in-right ms-1"></i>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}