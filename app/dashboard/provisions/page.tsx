// app/dashboard/provisions/page.tsx

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { createDepartment } from '../actions';
import Link from 'next/link';
import LogoutButton from '../components/LogoutButton';
import { redirect } from 'next/navigation';

export default async function ProvisionPage() {

  // --------------------------------------------------
  // SUPER ADMIN AUTHENTICATION
  // --------------------------------------------------

  const session = await auth();

  if (!session || session.user?.email !== 'kent.bsece@gmail.com') {
    redirect('/dashboard');
  }

  // --------------------------------------------------
  // FETCH DEPARTMENTS
  // --------------------------------------------------

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
            Department Provisioning
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

        <Link
          href="/dashboard"
          className="btn btn-outline-secondary"
        >
          <i className="bi bi-arrow-left me-2"></i>
          Dashboard
        </Link>

      </div>

      <div className="row g-5">

        {/* PROVISION FORM */}
<div className="col-12 col-lg-4">

  <div
    className="card p-4 border-secondary shadow-lg bg-card sticky-top"
    style={{ 
      top: '2rem',
      maxHeight: 'calc(100vh - 4rem)', // Constraints height to viewport minus top/bottom margins
      overflowY: 'auto'                // Adds a vertical scrollbar inside the card when needed
    }}
  >
    
    <h5 className="fw-bold text-accent mb-1">
      <i className="bi bi-building-gear me-2"></i>
      Provision Department
    </h5>

            <p className="text-secondary small mb-4">
              Create a new College or Department.
            </p>

            <form
              action={async (formData) => {
                'use server';
                await createDepartment(formData);
              }}
            >
              <div className="mb-3">
                <label className="form-label text-secondary small fw-semibold">
                  Department / College Name
                </label>
                <input
                  type="text"
                  name="name"
                  placeholder="College of Nursing"
                  className="form-control bg-body border-secondary"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label text-secondary small fw-semibold">
                  Subdomain Prefix
                </label>
                <input
                  type="text"
                  name="subdomain"
                  placeholder="nursing"
                  className="form-control bg-body border-secondary"
                  required
                />
              </div>

              <hr className="border-secondary my-3" />
              <div className="text-accent fw-bold small mb-3">Initial Department Administrator</div>

              <div className="mb-3">
                <label className="form-label text-secondary small fw-semibold">Admin Full Name</label>
                <input
                  type="text"
                  name="adminName"
                  placeholder="Dr. Jane Doe"
                  className="form-control bg-body border-secondary"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label text-secondary small fw-semibold">Admin Username</label>
                <input
                  type="text"
                  name="adminUsername"
                  placeholder="nursing_admin"
                  className="form-control bg-body border-secondary"
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label text-secondary small fw-semibold">Admin Email</label>
                <input
                  type="email"
                  name="adminEmail"
                  placeholder="admin.nursing@fcu.edu.ph"
                  className="form-control bg-body border-secondary"
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-warning w-100 fw-bold py-2 shadow-sm mt-2"
              >
                <i className="bi bi-plus-circle-fill me-2"></i>
                Provision Department & Admin
              </button>
            </form>

            {/* SECURITY INFORMATION */}
            <div className="border-top border-secondary mt-4 pt-4">

              <div className="alert alert-warning bg-dark border-warning small mb-0">

                <div className="fw-bold mb-1">
                  <i className="bi bi-shield-lock-fill me-2"></i>
                  Administrative Mode
                </div>

                <div className="text-secondary">
                  You are currently authenticated as
                  Super Administrator.
                </div>

              </div>

            </div>

          </div>

        </div>

        {/* ACTIVE DEPARTMENTS */}
        <div className="col-12 col-lg-8">

          <h5 className="fw-bold text-accent mb-4">
            <i className="bi bi-grid-fill me-2"></i>
            Active Departments Matrix
          </h5>

          {departments.length === 0 ? (

            <div className="card border-secondary bg-card shadow-sm p-5 text-center">

              <i className="bi bi-building-x fs-1 text-secondary mb-3"></i>

              <h5 className="fw-bold text-secondary">
                No Departments Provisioned
              </h5>

              <p className="text-secondary small mb-0">
                Create the first College or Department
                using the Provision form.
              </p>

            </div>

          ) : (

            <div className="row g-4">

              {departments.map((dept) => (

                <div
                  key={dept.id}
                  className="col-12 col-sm-6"
                >

                  <Link
                    href={getDeptUrl(dept.subdomain)}
                    className="text-decoration-none"
                  >

                    <div className="card h-100 text-center border-secondary shadow-sm p-4 bg-card transition-all">

                      <div className="mb-3">
                        <i className="bi bi-building-check fs-1 text-info"></i>
                      </div>

                      <h6 className="fw-bold text-color mb-1">
                        {dept.name}
                      </h6>

                      <small className="text-info">
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

    </div>
  );
}