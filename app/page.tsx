import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function RootPage() {
  const session = await auth();

  // Determine destination URL if the user is logged in
  let dashboardUrl = '/dashboard';
  if (session?.user) {
    if (session.user.role === 'SuperAdmin') {
      dashboardUrl = '/dashboard/';
    } else if (session.user.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { subdomain: true },
      });
      if (org?.subdomain) {
        dashboardUrl = `/department/${org.subdomain}`;
      }
    }
  }

  const isLoggedIn = Boolean(session?.user);

  return (
    <div className="min-vh-100 d-flex flex-column bg-canvas text-color position-relative overflow-hidden">
      
      {/* Background Ambient Glows */}
      <div 
        className="position-absolute rounded-circle pointer-events-none" 
        style={{
          width: '550px',
          height: '550px',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, rgba(0, 0, 0, 0) 70%)',
          top: '-150px',
          left: '-150px',
          zIndex: 0
        }}
      />
      <div 
        className="position-absolute rounded-circle pointer-events-none d-none d-md-block" 
        style={{
          width: '500px',
          height: '500px',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.08) 0%, rgba(0, 0, 0, 0) 70%)',
          bottom: '-100px',
          right: '-100px',
          zIndex: 0
        }}
      />

      {/* Navigation Header */}
      <nav className="border-bottom border-secondary position-relative py-3" style={{ zIndex: 10, backdropFilter: 'blur(8px)' }}>
        <div className="container d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-2">
            <div 
              className="bg-info bg-opacity-10 border border-info border-opacity-25 rounded d-flex align-items-center justify-content-center" 
              style={{ width: '40px', height: '40px' }}
            >
              <i className="bi bi-shield-check text-info fs-5"></i>
            </div>
            <div>
              <span className="fw-bold fs-5 tracking-tight d-block lh-1">CLEAR System</span>
              <small className="text-secondary" style={{ fontSize: '0.65rem' }}>CENTRALIZED LIQUIDATION OF EXPENSES & AUDIT RECORDS SYSTEM</small>
            </div>
          </div>

          <div className="d-flex align-items-center gap-3">
            <Link 
              href={dashboardUrl} 
              className="btn btn-info btn-sm fw-bold px-3 py-2 shadow-sm d-flex align-items-center gap-2"
            >
              <span>{isLoggedIn ? 'Go to Workspace' : 'Access Portal'}</span>
              <i className="bi bi-arrow-right"></i>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-grow-1 d-flex align-items-center py-5 position-relative" style={{ zIndex: 10 }}>
        <div className="container py-4">
          <div className="row align-items-center g-5">
            
            {/* Left Column: Core Value Proposition */}
            <div className="col-12 col-lg-7">
              <div className="d-inline-flex align-items-center gap-2 badge border border-info border-opacity-25 bg-info bg-opacity-10 text-info px-3 py-2 rounded-pill mb-4 font-monospace small">
                <i className="bi bi-patch-check-fill"></i>
                <span>Enterprise Multi-Tenant Architecture</span>
              </div>

              <h1 className="display-4 fw-bold mb-3" style={{ letterSpacing: '-0.03em', lineHeight: 1.15 }}>
                Centralized Liquidation & Audit Records for <span className="text-accent">Campus Organizations</span>
              </h1>

              <p className="lead text-secondary mb-4 fs-6" style={{ maxWidth: '620px', lineHeight: 1.6 }}>
                Eliminate paper-heavy liquidation queues, untracked fees, and lost cash receipts. CLEAR equips university departments and student councils with automated collection rosters, instant clearance tracking, and immutable audit logs.
              </p>

              <div className="d-flex flex-wrap gap-3 mb-5">
                <Link 
                  href={dashboardUrl} 
                  className="btn btn-warning fw-bold px-4 py-2 shadow-sm d-flex align-items-center gap-2"
                >
                  <i className="bi bi-box-arrow-in-right"></i>
                  <span>{isLoggedIn ? 'Open Your Portal' : 'Enter Organization Portal'}</span>
                </Link>
                <a 
                  href="#features" 
                  className="btn btn-outline-secondary px-4 py-2"
                >
                  Explore Capabilities
                </a>
              </div>

              {/* Security & Architecture Highlights */}
              <div className="row g-3 pt-3 border-top border-secondary border-opacity-50">
                <div className="col-4">
                  <div className="fw-bold fs-5 text-accent">Isolated</div>
                  <div className="text-secondary small" style={{ fontSize: '0.75rem' }}>Tenant Data Silos</div>
                </div>
                <div className="col-4">
                  <div className="fw-bold fs-5 text-success">Zero-Trust</div>
                  <div className="text-secondary small" style={{ fontSize: '0.75rem' }}>OTP Verification</div>
                </div>
                <div className="col-4">
                  <div className="fw-bold fs-5 text-info">Immutable</div>
                  <div className="text-secondary small" style={{ fontSize: '0.75rem' }}>Full Audit Trail</div>
                </div>
              </div>
            </div>

            {/* Right Column: Visual Dashboard Preview Card */}
            <div className="col-12 col-lg-5">
              <div className="card border-secondary shadow-lg p-4 hover-lift position-relative overflow-hidden">
                <div className="d-flex justify-content-between align-items-center border-bottom border-secondary pb-3 mb-3">
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25 font-monospace">
                      SYSTEM ACTIVE
                    </span>
                    <small className="text-secondary font-monospace">A.Y. 2026 - 2027</small>
                  </div>
                  <i className="bi bi-cpu text-info"></i>
                </div>

                <h6 className="fw-bold text-accent mb-1">Instant Clearance & Audit Metrics</h6>
                <p className="text-secondary small mb-3">Real-time status overview across department operations.</p>

                <div className="vstack gap-2 mb-3">
                  <div className="p-2 rounded bg-body border border-secondary border-opacity-50 d-flex justify-content-between align-items-center">
                    <span className="small text-secondary">Collections Cleared</span>
                    <span className="text-success font-monospace fw-bold">98.4%</span>
                  </div>
                  <div className="p-2 rounded bg-body border border-secondary border-opacity-50 d-flex justify-content-between align-items-center">
                    <span className="small text-secondary">Audited Liquidations</span>
                    <span className="text-info font-monospace fw-bold">₱0.00 Variance</span>
                  </div>
                  <div className="p-2 rounded bg-body border border-secondary border-opacity-50 d-flex justify-content-between align-items-center">
                    <span className="small text-secondary">Student Directory</span>
                    <span className="text-accent font-monospace fw-bold">Synchronized</span>
                  </div>
                </div>

                <div className="p-3 rounded bg-dark border border-warning border-opacity-25">
                  <div className="d-flex align-items-center gap-2 text-warning small fw-semibold mb-1">
                    <i className="bi bi-shield-lock-fill"></i>
                    Role-Based Access Guard
                  </div>
                  <p className="text-secondary small mb-0" style={{ fontSize: '0.75rem' }}>
                    Access restricted to authorized academic personnel, advisers, treasurers, and university auditors.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Feature Capabilities Grid */}
      <section id="features" className="py-5 border-top border-secondary bg-surface position-relative" style={{ zIndex: 10 }}>
        <div className="container py-4">
          <div className="text-center mb-5">
            <span className="badge bg-primary bg-opacity-10 text-accent font-monospace px-3 py-1 mb-2">FEATURES</span>
            <h2 className="fw-bold">Engineered for Academic Accountability</h2>
            <p className="text-secondary small mx-auto" style={{ maxWidth: '550px' }}>
              Built specifically to handle the unique financial workflows of college organizations and student chapters.
            </p>
          </div>

          <div className="row g-4">
            <div className="col-12 col-md-6 col-lg-4">
              <div className="card h-100 p-4 border-secondary hover-lift">
                <i className="bi bi-people-fill text-info fs-3 mb-3"></i>
                <h5 className="fw-bold mb-2">Roster & Bulk Import</h5>
                <p className="text-secondary small mb-0">
                  Import hundreds of student records via CSV in seconds. Track real-time term enrollment, active directory counts, and batch promote year levels.
                </p>
              </div>
            </div>

            <div className="col-12 col-md-6 col-lg-4">
              <div className="card h-100 p-4 border-secondary hover-lift">
                <i className="bi bi-receipt-cutoff text-success fs-3 mb-3"></i>
                <h5 className="fw-bold mb-2">Collections & Clearance</h5>
                <p className="text-secondary small mb-0">
                  Log official receipts, manage uniform and package dues, compute outstanding balances, and authorize graduation clearances automatically.
                </p>
              </div>
            </div>

            <div className="col-12 col-md-6 col-lg-4">
              <div className="card h-100 p-4 border-secondary hover-lift">
                <i className="bi bi-file-earmark-spreadsheet text-warning fs-3 mb-3"></i>
                <h5 className="fw-bold mb-2">Reports & Analytics</h5>
                <p className="text-secondary small mb-0">
                  Generate comprehensive CSV exports, breakdown collection percentages by year level, and review audited expense balances with one click.
                </p>
              </div>
            </div>

            <div className="col-12 col-md-6 col-lg-4">
              <div className="card h-100 p-4 border-secondary hover-lift">
                <i className="bi bi-journal-text text-accent fs-3 mb-3"></i>
                <h5 className="fw-bold mb-2">Immutable Audit Trails</h5>
                <p className="text-secondary small mb-0">
                  Every user interaction, cash void request, and privilege modification is captured with exact timestamps for administrative accountability.
                </p>
              </div>
            </div>

            <div className="col-12 col-md-6 col-lg-4">
              <div className="card h-100 p-4 border-secondary hover-lift">
                <i className="bi bi-building-gear text-danger fs-3 mb-3"></i>
                <h5 className="fw-bold mb-2">Multi-Tenant Isolation</h5>
                <p className="text-secondary small mb-0">
                  Host independent departments—Engineering, Nursing, Business, and more—with isolated ledgers, distinct rosters, and individual admin teams.
                </p>
              </div>
            </div>

            <div className="col-12 col-md-6 col-lg-4">
              <div className="card h-100 p-4 border-secondary hover-lift">
                <i className="bi bi-printer text-info fs-3 mb-3"></i>
                <h5 className="fw-bold mb-2">Print-Optimized Ledgers</h5>
                <p className="text-secondary small mb-0">
                  Built-in formal print stylesheets generate black-and-white reports and signature blocks ready for dean approvals and external auditors.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}