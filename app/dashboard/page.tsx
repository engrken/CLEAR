// app/dashboard/page.tsx
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Metadata } from 'next';
import OrganizationLogo from '@/components/OrganizationLogo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function DashboardPage() {
  // Fetch only Active entities alphabetically for the public directory
  const departments = await prisma.organization.findMany({
    where: { status: 'Active' },
    orderBy: { name: 'asc' },
  });

  const getDeptUrl = (subdomain: string) => `/department/${encodeURIComponent(subdomain)}`;

  const isOrgType = (type: string | null) =>
    type === 'Organization' || type === 'Student Organization';

  return (
    <div className="w-100 min-vh-100 bg-canvas d-flex flex-column">
      {/* INLINE CSS FOR PREMIUM SAAS AESTHETICS */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .hero-section {
          background: radial-gradient(circle at top, #1e293b, #0f172a);
          border-bottom: 1px solid #334155;
          padding: 3.5rem 1rem 3rem 1rem;
        }
        .entity-card {
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          background-color: #1e293b;
          border: 1px solid #334155;
          border-radius: 1rem;
        }
        .entity-card:hover {
          transform: translateY(-8px);
          border-color: #38bdf8 !important;
          box-shadow: 0 15px 35px rgba(0,0,0,0.4) !important;
        }
        .logo-wrapper {
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #0f172a;
          border-radius: 50%;
          margin: 0 auto 1rem auto;
          border: 2px solid #334155;
          padding: 0.75rem;
          transition: border-color 0.3s ease;
        }
        .entity-card:hover .logo-wrapper {
          border-color: #38bdf8;
        }
        .glow-text {
          background: linear-gradient(to right, #38bdf8, #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
      `,
        }}
      />

      {/* HERO SECTION */}
      <div className="hero-section text-center position-relative w-100">
        <div className="container" style={{ maxWidth: '900px' }}>
          <div className="d-inline-block mb-3 px-3 py-1 rounded-pill bg-info bg-opacity-10 border border-info border-opacity-25 text-info fw-bold small shadow-sm">
            <i className="bi bi-shield-check me-2"></i>Secure Institutional Platform
          </div>
          <h1 className="display-4 fw-bold mb-3 text-white">
            Welcome to the <span className="glow-text">CLEAR System</span>
          </h1>
          <p className="lead text-secondary mb-5">
            <b>C</b>entralized <b>L</b>iquidation of <b>E</b>xpenses & <b>A</b>udit <b>R</b>ecords.{' '}
            <br className="d-none d-md-block" />
            Select an active entity below to access the financial portal, or log in to manage system provisions.
          </p>

          <div className="d-flex justify-content-center gap-3 flex-wrap">
            {/* 
			
			Master Admin Provisioning 
            <button
              type="button"
              className="btn btn-info fw-bold px-4 py-2 shadow"
              data-bs-toggle="modal"
              data-bs-target="#otpAuthModal"
            >
              <i className="bi bi-gear-fill me-2"></i>
              System SuperAdmin Access
            </button>
			
			*/}

            <button type="button" className="btn btn-info fw-bold px-4 py-2 shadow"
              data-bs-toggle="modal" data-bs-target="#otpAuthModal">
              <i className="bi bi-shield-lock me-2" />System SuperAdmin Access
            </button>
            {/* Entity Admin Portal */}
            <Link
              href="/dashboard/entity/login"
              className="btn btn-outline-light fw-bold px-4 py-2 shadow"
            >
              <i className="bi bi-building-fill-gear me-2"></i>
              Entity Admin Portal
            </Link>
            <Link href="/register/organization" className="btn btn-outline-info fw-bold px-4 py-2 shadow"><i className="bi bi-building-add me-2"></i>Organization / School not listed? Register here</Link>
          </div>
        </div>
      </div>

      {/* MAIN ENTITY GRID SECTION */}
      <div className="flex-grow-1 py-5">
        <div className="container" style={{ maxWidth: '1200px' }}>
          <div className="d-flex justify-content-between align-items-center mb-4 px-2">
            <h5 className="fw-bold text-white mb-0">
              <i className="bi bi-grid-fill me-2 text-secondary"></i>
              Active Institutional Entities
            </h5>
            <span className="badge bg-secondary px-3 py-2 rounded-pill shadow-sm">
              {departments.length} Active
            </span>
          </div>

          {departments.length === 0 ? (
            /* EMPTY STATE */
            <div className="card entity-card shadow-lg p-5 text-center border-secondary mt-3">
              <div className="mb-4">
                <i
                  className="bi bi-building-x text-secondary opacity-50"
                  style={{ fontSize: '4rem' }}
                ></i>
              </div>
              <h4 className="fw-bold text-white mb-2">No Active Entities Provisioned Yet</h4>
              <p className="text-secondary mb-0 mx-auto" style={{ maxWidth: '500px' }}>
                Your school or organization can <Link href="/register/organization" className="text-info">register for a Freemium workspace</Link> without requesting manual provisioning.
              </p>
            </div>
          ) : (
            /* DYNAMIC GRID */
            <div className="row g-4">
              {departments.map((dept) => (
                <div key={dept.id} className="col-12 col-sm-6 col-lg-4">
                  <Link href={getDeptUrl(dept.subdomain)} className="text-decoration-none">
                    <div className="card entity-card h-100 text-center p-4 position-relative">
                      {/* DYNAMIC ENTITY BADGE */}
                      <div className="position-absolute top-0 start-50 translate-middle-x">
                        <span
                          className={`badge rounded-bottom-3 px-3 py-1 shadow-sm ${
                            isOrgType(dept.type) ? 'bg-warning text-dark' : 'bg-info text-dark'
                          }`}
                        >
                          <i
                            className={`me-1 ${
                              isOrgType(dept.type) ? 'bi bi-people-fill' : 'bi bi-building'
                            }`}
                          ></i>
                          {dept.type || 'Department'}
                        </span>
                      </div>

                      {/* LOGO WRAPPER */}
                      <div className="logo-wrapper mt-3">
                        <OrganizationLogo
                          src={dept.logo}
                          alt={`${dept.name} logo`}
                          className="img-fluid"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))',
                          }}
                        />
                      </div>

                      {/* ENTITY NAME & LINK */}
                      <h5 className="fw-bold text-white mb-2 px-2" style={{ lineHeight: '1.3' }}>
                        {dept.name}
                      </h5>

                      <div className="mt-auto pt-3">
                        <span className="text-secondary small font-monospace d-flex align-items-center justify-content-center gap-1">
                          /department/{dept.subdomain}
                          <i className="bi bi-box-arrow-in-right opacity-50 ms-1"></i>
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ADMIN OTP LOGIN MODAL */}
    </div>
  );
}