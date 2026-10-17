// /app/dashboard/entity/portal/page.tsx
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { logoutEntityAdminAction } from '../actions';
import { getAuthenticatedEntityAdmin } from '@/lib/entity-session';
import { EntityProvisionForm } from './EntityProvisionForm';
import { isSuperAdminEmail } from '@/lib/permissions';

export default async function EntityPortalPage() {
  const session = await auth();
  const cookieEmail = await getAuthenticatedEntityAdmin();

  const email = String(cookieEmail || session?.user?.email || '')
    .trim()
    .toLowerCase();

  if (!email) {
    redirect('/dashboard/entity/login');
  }

  const superAdmin = isSuperAdminEmail(email);

  // Fetch admin records for this email
  const userAdminRecords = await prisma.tenantUser.findMany({
    where: { 
      email: { equals: email, mode: 'insensitive' },
      role: { in: ['admin', 'administrator', 'superadmin'], mode: 'insensitive' },
      status: 'Active',
    },
    include: { organization: true },
  });

  if (!superAdmin && userAdminRecords.length === 0) {
    redirect('/dashboard/entity/login');
  }

  const primaryOrg = userAdminRecords[0]?.organization;
  const schoolGroup = primaryOrg?.schoolGroup || 'default-school';

  // SUPERADMIN BYPASS: If SuperAdmin, fetch ALL organizations across all school groups.
  // Otherwise, scope strictly to their institutional schoolGroup.
  const entityGroupOrgs = superAdmin
    ? await prisma.organization.findMany({
        orderBy: [{ schoolGroup: 'asc' }, { name: 'asc' }],
        include: {
          _count: {
            select: { students: true, collections: true, tenantUsers: true },
          },
        },
      })
    : await prisma.organization.findMany({
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

  const currentTier = superAdmin ? 'Platform Global' : (primaryOrg?.tier || 'Freemium');
  const maxAllowed = superAdmin ? 999999 : (currentTier === 'Freemium' ? 2 : currentTier === 'Pro' ? 10 : 999);
  const canAddMore = true; // Super admins can always provision freely

  return (
    <div className="container py-5 text-white" style={{ maxWidth: '1200px' }}>
      {/* Top Bar Navigation */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex gap-3">
          <Link href="/dashboard" className="text-secondary small text-decoration-none">
            <i className="bi bi-arrow-left me-1"></i> Back to Public Directory
          </Link>
          <Link href="/dashboard/provisions" className="text-info small text-decoration-none fw-bold">
            <i className="bi bi-gear-fill me-1"></i> Master Provisions Panel
          </Link>
        </div>
        <div className="d-flex align-items-center gap-3">
          <span className="text-secondary small font-monospace">
            <i className="bi bi-shield-fill-check text-info me-1"></i>
            {email} {superAdmin && '(SuperAdmin)'}
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
              {superAdmin ? 'Global Platform Access' : `Institutional Group: ${schoolGroup}`}
            </span>
            <h2 className="fw-bold mb-1 text-white">Entity Management Portal</h2>
            <p className="text-secondary small mb-0">
              {superAdmin 
                ? 'Viewing all provisioned entities across all school groups platform-wide.' 
                : 'Manage associated entities and track tier resource allocation.'}
            </p>
          </div>
          <div className="text-end bg-secondary bg-opacity-10 border border-secondary p-3 rounded">
            <div className="small text-secondary text-uppercase fw-bold">Privilege Level</div>
            <div className="fs-5 fw-bold text-info">{superAdmin ? 'SuperAdmin' : currentTier}</div>
            <div className="small text-secondary">
              {entityGroupOrgs.length} Total Entities Managed
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Left Column: Self-Service Provision Form */}
        <div className="col-12 col-lg-4">
          <div className="card bg-dark border-secondary p-4 shadow-sm h-100">
            <h5 className="fw-bold text-white border-bottom border-secondary pb-3 mb-3">
              Add New Entity Workspace
            </h5>
            <EntityProvisionForm
              schoolGroup={superAdmin ? 'fcu' : schoolGroup}
              currentTier={superAdmin ? 'Corporate' : currentTier}
              canAddMore={canAddMore}
            />
          </div>
        </div>

        {/* Right Column: Entity List Table */}
        <div className="col-12 col-lg-8">
          <div className="card bg-dark border-secondary p-4 shadow-sm h-100">
            <h5 className="fw-bold text-white border-bottom border-secondary pb-3 mb-3">
              {superAdmin ? 'All Platform Entities' : 'Associated Group Entities'} ({entityGroupOrgs.length})
            </h5>

            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle text-start mb-0">
                <thead>
                  <tr className="text-secondary small text-uppercase">
                    <th>Entity / Subdomain</th>
                    <th>Group</th>
                    <th>Type</th>
                    <th>Status</th>
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
                        <span className="badge bg-secondary font-monospace">{org.schoolGroup}</span>
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