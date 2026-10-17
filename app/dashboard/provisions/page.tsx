// app/dashboard/provisions/page.tsx
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import LogoutButton from '../components/LogoutButton';
import ProvisionModal from '../components/ProvisionModal';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { isSuperAdminEmail } from '@/lib/permissions';
import { updateOrganizationStatus, deleteOrganization } from './actions';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function ProvisionPage() {
  const session = await auth();

  if (!session || !isSuperAdminEmail(session.user?.email)) {
    redirect('/dashboard');
  }

  const departments = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' }
  });

  const isProduction = Boolean(
    process.env.NODE_ENV === 'production' || process.env.VERCEL
  );

  const getDeptUrl = (subdomain: string) => {
    if (isProduction) {
      return `/department/${subdomain}`;
    }
    return `http://localhost:3000/department/${subdomain}`;
  };

  return (
    <div className="container py-5" style={{ maxWidth: '1200px' }}>

      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-5 border-bottom border-secondary pb-3">
        <div>
          <h2 className="fw-bold text-accent m-0">
            <i className="bi bi-shield-check me-2"></i>
            CLEAR System Master Admin
          </h2>
          <p className="text-secondary small mb-0 mt-1">
            Entity Provisioning &amp; Tenant Lifecycle Management Dashboard
          </p>
        </div>

        <div className="d-flex align-items-center gap-3">
          <span className="text-success fw-bold small d-none d-md-inline">
            <i className="bi bi-person-circle me-1"></i>
            {session.user.email}
          </span>
          <LogoutButton />
        </div>
      </div>

      {/* BACK TO DASHBOARD */}
      <div className="mb-4">
        <Link href="/dashboard" className="btn btn-outline-secondary">
          <i className="bi bi-arrow-left me-2"></i>
          Dashboard
        </Link>
      </div>

      <div className="row g-5">

        {/* LEFT COLUMN: PROVISION TRIGGER */}
        <div className="col-12 col-lg-4">
          <div
            className="card p-4 border-secondary shadow-lg bg-card sticky-top"
            style={{ top: '2rem' }}
          >
            <h5 className="fw-bold text-accent mb-1">
              <i className="bi bi-building-gear me-2"></i>
              Provision Entity
            </h5>

            <p className="text-secondary small mb-4">
              Create a new Academic Department or Student Organization and assign its initial administrator.
            </p>

            <div className="d-grid">
              <button 
                type="button" 
                className="btn btn-primary fw-bold shadow-sm" 
                data-bs-toggle="modal" 
                data-bs-target="#provisionModal"
              >
                <i className="bi bi-building-add me-2"></i> Provision New Entity
              </button>
            </div>

            <div className="border-top border-secondary mt-4 pt-4">
              <div className="alert alert-warning bg-dark border-warning small mb-0">
                <div className="fw-bold mb-1">
                  <i className="bi bi-shield-lock-fill me-2"></i>
                  Administrative Mode
                </div>
                <div className="text-secondary">
                  You are currently authenticated as Super Administrator.
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE ENTITIES MATRIX */}
        <div className="col-12 col-lg-8">
          <h5 className="fw-bold text-accent mb-4">
            <i className="bi bi-grid-fill me-2"></i>
            Active Entities Matrix
          </h5>

          {departments.length === 0 ? (
            <div className="card border-secondary bg-card shadow-sm p-5 text-center">
              <i className="bi bi-building-x fs-1 text-secondary mb-3"></i>
              <h5 className="fw-bold text-secondary">
                No Entities Provisioned
              </h5>
              <p className="text-secondary small mb-0">
                Create the first Department or Organization using the Provision button.
              </p>
            </div>
          ) : (
            <div className="row g-4">
              {departments.map((dept) => {
                const tenantStatus = (dept as any).status || 'Active';
                
                return (
                  <div key={dept.id} className="col-12 col-sm-6">
                    <div className="card h-100 border-secondary shadow-sm p-3 bg-card d-flex flex-column justify-content-between position-relative">
                      
                      {/* Entity Type & Status Badges */}
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className={`badge ${dept.type === 'Organization' ? 'bg-warning text-dark' : 'bg-info text-dark'}`}>
                          {dept.type || 'Department'}
                        </span>
                        <span className={`badge ${
                          tenantStatus === 'Active' ? 'bg-success' : tenantStatus === 'Inactive' ? 'bg-warning text-dark' : 'bg-secondary'
                        }`}>
                          {tenantStatus}
                        </span>
                      </div>

                      {/* CARD BODY LINK (Clicking navigates to entity) */}
                      <Link
                        href={getDeptUrl(dept.subdomain)}
                        className="text-decoration-none text-center my-2"
                      >
                        <div className="d-flex justify-content-center align-items-center" style={{ height: '50px' }}>
                          {dept.logo ? (
                            <img 
                              src={dept.logo} 
                              alt={`${dept.name} logo`} 
                              style={{ maxWidth: '50px', maxHeight: '50px', objectFit: 'contain' }} 
                            />
                          ) : (
                            <i className={`fs-2 ${dept.type === 'Organization' ? 'bi bi-people-fill text-warning' : 'bi bi-building-check text-info'}`}></i>
                          )}
                        </div>

                        <h6 className="fw-bold text-color mb-1 mt-2">
                          {dept.name}
                        </h6>

                        <small className="text-info font-monospace">
                          {isProduction
                            ? `/department/${dept.subdomain}`
                            : `http://localhost:3000/department/${dept.subdomain}`}
                        </small>
                      </Link>

                      {/* TENANT MANAGEMENT CONTROLS */}
                      <div className="border-top border-secondary pt-3 mt-2 d-flex flex-column gap-2">
                        <div className="d-flex justify-content-between gap-1">
                          {tenantStatus !== 'Active' && (
                            <form action={async () => { 'use server'; await updateOrganizationStatus(dept.id, 'Active'); }}>
                              <button type="submit" className="btn btn-outline-success btn-sm w-100 py-0" style={{ fontSize: '0.75rem' }}>
                                Active
                              </button>
                            </form>
                          )}
                          {tenantStatus !== 'Inactive' && (
                            <form action={async () => { 'use server'; await updateOrganizationStatus(dept.id, 'Inactive'); }}>
                              <button type="submit" className="btn btn-outline-warning btn-sm w-100 py-0" style={{ fontSize: '0.75rem' }}>
                                Inactive
                              </button>
                            </form>
                          )}
                          {tenantStatus !== 'Archived' && (
                            <form action={async () => { 'use server'; await updateOrganizationStatus(dept.id, 'Archived'); }}>
                              <button type="submit" className="btn btn-outline-secondary btn-sm w-100 py-0" style={{ fontSize: '0.75rem' }}>
                                Archive
                              </button>
                            </form>
                          )}
                        </div>

                        <form action={async () => { 
                          'use server'; 
                          if (global.confirm && confirm(`Permanently delete ${dept.name}?`)) {
                            await deleteOrganization(dept.id);
                          }
                        }}>
                          <button type="submit" className="btn btn-outline-danger btn-sm w-100 py-0" style={{ fontSize: '0.75rem' }}>
                            <i className="bi bi-trash me-1"></i> Delete Tenant
                          </button>
                        </form>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ProvisionModal />

    </div>
  );
}