// app/dashboard/provisions/page.tsx
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import LogoutButton from '../components/LogoutButton';
import ProvisionModal from '../components/ProvisionModal';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'CLEAR System Master Admin',
};

export default async function ProvisionPage() {

  // --------------------------------------------------
  // SUPER ADMIN AUTHENTICATION
  // --------------------------------------------------
  const session = await auth();

  if (!session || session.user?.email !== 'kent.bsece@gmail.com') {
    redirect('/dashboard');
  }

  // --------------------------------------------------
  // FETCH ENTITIES (DEPARTMENTS & ORGANIZATIONS)
  // --------------------------------------------------
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

  // --------------------------------------------------
  // PROVISION PAGE
  // --------------------------------------------------
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
            Entity Provisioning Dashboard
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

            {/* EXPLICIT BOOTSTRAP MODAL BUTTON */}
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

            {/* SECURITY INFORMATION */}
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
              {departments.map((dept) => (
                <div key={dept.id} className="col-12 col-sm-6">
                  <Link
                    href={getDeptUrl(dept.subdomain)}
                    className="text-decoration-none"
                  >
                    <div className="card h-100 text-center border-secondary shadow-sm p-4 bg-card transition-all position-relative">
                      
                      {/* Entity Type Badge */}
                      <span className={`position-absolute top-0 start-50 translate-middle-x badge rounded-bottom ${dept.type === 'Organization' ? 'bg-warning text-dark' : 'bg-info text-dark'}`}>
                        {dept.type || 'Department'}
                      </span>

                      <div className="mb-3 mt-3 d-flex justify-content-center align-items-center" style={{ height: '60px' }}>
                        {dept.logo ? (
                          <img 
                            src={dept.logo} 
                            alt={`${dept.name} logo`} 
                            style={{ maxWidth: '60px', maxHeight: '60px', objectFit: 'contain' }} 
                          />
                        ) : (
                          <i className={`fs-1 ${dept.type === 'Organization' ? 'bi bi-people-fill text-warning' : 'bi bi-building-check text-info'}`}></i>
                        )}
                      </div>

                      <h6 className="fw-bold text-color mb-1">
                        {dept.name}
                      </h6>

                      <small className="text-info font-monospace">
                        {isProduction
                          ? `/department/${dept.subdomain}`
                          : `http://localhost:3000/department/${dept.subdomain}`}
                      </small>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RENDER MODAL ROOT-LEVEL TO PREVENT STACKING CONTEXT ISSUES */}
      <ProvisionModal />

    </div>
  );
}