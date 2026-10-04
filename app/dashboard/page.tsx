// app/dashboard/page.tsx

import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import AdminOtpModal from './components/AdminOtpModal';

export default async function DashboardPage() {
  const departments = await prisma.organization.findMany();

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
    <>
      <div className="container py-5" style={{ maxWidth: '1200px' }}>

        {/* HEADER */}
        <div className="d-flex justify-content-between align-items-center mb-5 border-bottom border-secondary pb-3">
          <div>
            <h2 className="fw-bold text-accent m-0">
              <i className="bi bi-grid-1x2-fill me-2"></i>
              CLEAR Dashboard
            </h2>

            <p className="text-secondary small mb-0 mt-1">
              College/Department Clearance and Administration System
            </p>
          </div>

          {/* LOGIN ACCESS */}
          <button
            type="button"
            className="btn btn-info fw-bold px-4"
            data-bs-toggle="modal"
            data-bs-target="#otpAuthModal"
          >
            <i className="bi bi-shield-lock-fill me-2"></i>
            Login Access
          </button>
        </div>

        {/* WELCOME */}
        <div className="card border-secondary shadow-lg bg-card p-4 mb-5">
          <div className="d-flex align-items-center gap-3">
            <div className="fs-1 text-info">
              <i className="bi bi-speedometer2"></i>
            </div>

            <div>
              <h4 className="fw-bold text-accent mb-1">
                Welcome to CLEAR
              </h4>

              <p className="text-secondary mb-0">
                Select an active department below to access its CLEAR system.
                Administrative provisioning is available through Login Access.
              </p>
            </div>
          </div>
        </div>

        {/* ACTIVE DEPARTMENTS */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h5 className="fw-bold text-accent mb-0">
            <i className="bi bi-building me-2"></i>
            Active Departments
          </h5>

          <span className="badge bg-secondary">
            {departments.length} Active
          </span>
        </div>

        {departments.length === 0 ? (

          <div className="card border-secondary bg-card shadow-sm p-5 text-center">
            <i className="bi bi-building-x fs-1 text-secondary mb-3"></i>

            <h5 className="fw-bold text-secondary">
              No Departments Provisioned
            </h5>

            <p className="text-secondary small mb-0">
              Use Login Access to authenticate as System Administrator
              and provision the first department.
            </p>
          </div>

        ) : (

          <div className="row g-4">

            {departments.map((dept) => (

              <div
                key={dept.id}
                className="col-12 col-sm-6 col-md-4"
              >

                {/* ENTIRE DEPARTMENT CARD IS CLICKABLE */}
                <Link
                  href={getDeptUrl(dept.subdomain)}
                  className="text-decoration-none"
                >

                  <div
                    className="card h-100 text-center border-secondary shadow-sm p-4 bg-card transition-all"
                    style={{ cursor: 'pointer' }}
                  >

                    {/* DEPARTMENT LOGO */}
                    <div className="mb-3">
                      <img
                        src={`/${dept.subdomain}_logo.png`}
                        alt={`${dept.name} Logo`}
                        className="img-fluid"
                        style={{
                          width: '110px',
                          height: '110px',
                          objectFit: 'contain',
                        }}
                      />
                    </div>

                    {/* DEPARTMENT NAME */}
                    <h6 className="fw-bold text-color mb-0">
                      {dept.name}
                    </h6>

                  </div>

                </Link>

              </div>

            ))}

          </div>

        )}

      </div>

      {/* ADMIN OTP LOGIN MODAL */}
      <AdminOtpModal />
    </>
  );
}