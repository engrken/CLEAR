// /app/dashboard/entity/portal/page.tsx

import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  getAuthenticatedEntityAdmin,
} from '@/lib/entity-session';
import { logoutEntityAdminAction } from '../actions';
import { EntityProvisionForm } from './EntityProvisionForm';
export const dynamic = 'force-dynamic';

const DEFAULT_GROUP = 'default-school';

function getMaxEntities(tier: string): number {
  switch (tier) {
    case 'Freemium':
      return 2;
    case 'Pro':
      return 10;
    case 'Corporate':
      return Number.MAX_SAFE_INTEGER;
    default:
      return 2;
  }
}

export default async function EntityPortalPage() {
  const identity = await getAuthenticatedEntityAdmin();

  if (!identity) {
    redirect('/dashboard/entity/login');
  }

  const superAdmin = identity.isSuperAdmin;

  const primaryOrg =
    !superAdmin && identity.organizationId
      ? await prisma.organization.findUnique({
          where: { id: identity.organizationId },
        })
      : null;

  if (
    !superAdmin &&
    (!primaryOrg || primaryOrg.status !== 'Active')
  ) {
    redirect('/dashboard/entity/login');
  }

  const schoolGroup = superAdmin
    ? 'Platform Global'
    : primaryOrg?.schoolGroup || DEFAULT_GROUP;

  const currentTier = superAdmin
    ? 'Platform Global'
    : primaryOrg?.tier || 'Freemium';

  const maxAllowed = superAdmin
    ? Number.MAX_SAFE_INTEGER
    : getMaxEntities(currentTier);

  const entityQueryInclude = {
    _count: {
      select: {
        students: true,
        collections: true,
        tenantUsers: true,
      },
    },
  } as const;

  // Super Admin can inspect every tenant.
  // Tenant admins are restricted to their current group.
  // default-school is ungrouped, so show only the authenticated root tenant.
  const entityGroupOrgs = superAdmin
    ? await prisma.organization.findMany({
        orderBy: [
          { schoolGroup: 'asc' },
          { name: 'asc' },
        ],
        include: entityQueryInclude,
      })
    : schoolGroup === DEFAULT_GROUP
      ? await prisma.organization.findMany({
          where: {
            id: primaryOrg!.id,
          },
          orderBy: { name: 'asc' },
          include: entityQueryInclude,
        })
      : await prisma.organization.findMany({
          where: {
            schoolGroup,
          },
          orderBy: { name: 'asc' },
          include: entityQueryInclude,
        });

  const canAddMore =
    !superAdmin &&
    entityGroupOrgs.length < maxAllowed;

  return (
    <div
      className="container py-5 text-white"
      style={{ maxWidth: '1200px' }}
    >
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex gap-3 flex-wrap">
          <Link
            href="/dashboard"
            className="text-secondary small text-decoration-none"
          >
            <i className="bi bi-arrow-left me-1" />
            Back to Public Directory
          </Link>

          {superAdmin && (
            <Link href="/dashboard/provisions" className="text-info small text-decoration-none fw-bold">
              <i className="bi bi-gear-fill me-1" /> Master Provisions Panel
            </Link>
          )}
        </div>

        <div className="d-flex align-items-center gap-3">
          <span className="text-secondary small font-monospace">
            <i className="bi bi-shield-fill-check text-info me-1" />
            {identity.email}
            {superAdmin && ' (SuperAdmin)'}
          </span>

          <form action={logoutEntityAdminAction}>
            <button
              type="submit"
              className="btn btn-sm btn-outline-secondary"
            >
              <i className="bi bi-box-arrow-right me-1" />
              Sign Out
            </button>
          </form>
        </div>
      </div>

      <div className="card bg-dark border-secondary p-4 mb-4 shadow-sm">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <span className="badge bg-info text-dark mb-2 fw-bold text-uppercase">
              {superAdmin
                ? 'Global Platform Access'
                : `Institutional Group: ${schoolGroup}`}
            </span>

            <h2 className="fw-bold mb-1 text-white">
              Entity Management Portal
            </h2>

            <p className="text-secondary small mb-0">
              {superAdmin
                ? 'View platform organizations and manage provisioning through the Master Provisions Panel.'
                : 'Create and manage workspaces belonging to your authorized institutional group.'}
            </p>
          </div>

          <div className="text-end bg-secondary bg-opacity-10 border border-secondary p-3 rounded">
            <div className="small text-secondary text-uppercase fw-bold">
              Privilege Level
            </div>

            <div className="fs-5 fw-bold text-info">
              {superAdmin ? 'SuperAdmin' : currentTier}
            </div>

            <div className="small text-secondary">
              {entityGroupOrgs.length} Total Entities Managed
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-lg-4">
          <div className="card bg-dark border-secondary p-4 shadow-sm h-100">
            <h5 className="fw-bold text-white border-bottom border-secondary pb-3 mb-3">
              Add New Entity Workspace
            </h5>

            {superAdmin ? (
              <div className="alert alert-info small mb-0">
                Use the Master Provisions Panel to create top-level entities.
                Super Admin does not need a duplicate account in each tenant.
                <div className="mt-3">
                  <Link
                    href="/dashboard/provisions"
                    className="btn btn-info btn-sm fw-bold text-dark"
                  >
                    Open Master Provisions
                  </Link>
                </div>
              </div>
            ) : (
              <EntityProvisionForm
                schoolGroup={schoolGroup}
                currentTier={currentTier}
                canAddMore={canAddMore}
              />
            )}
          </div>
        </div>

        <div className="col-12 col-lg-8">
          <div className="card bg-dark border-secondary p-4 shadow-sm h-100">
            <h5 className="fw-bold text-white border-bottom border-secondary pb-3 mb-3">
              {superAdmin
                ? 'All Platform Entities'
                : 'Associated Group Entities'}{' '}
              ({entityGroupOrgs.length})
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
                        <div className="fw-bold text-white">
                          {org.name}
                        </div>
                        <div className="small text-info font-monospace">
                          /department/{org.subdomain}
                        </div>
                      </td>

                      <td>
                        <span className="badge bg-secondary font-monospace">
                          {org.schoolGroup}
                        </span>
                      </td>

                      <td>
                        <span className="badge bg-secondary text-light">
                          {org.type || 'Department'}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            org.status === 'Active'
                              ? 'bg-success'
                              : 'bg-danger'
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
                          Open Portal
                          <i className="bi bi-box-arrow-in-right ms-1" />
                        </Link>
                      </td>
                    </tr>
                  ))}

                  {entityGroupOrgs.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-center text-secondary py-4"
                      >
                        No organizations are available in this view.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {!superAdmin && (
              <p className="text-secondary small mt-3 mb-0">
                {canAddMore
                  ? `${Math.max(0, maxAllowed - entityGroupOrgs.length)} workspace slot(s) remaining under your current tier.`
                  : `Your current ${currentTier} tier has reached its workspace limit.`}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}