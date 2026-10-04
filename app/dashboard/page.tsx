// app/dashboard/page.tsx
import { auth } from '@/auth'; 
import { prisma } from '@/lib/prisma';
import { createDepartment } from './actions';
import Link from 'next/link';
import LogoutButton from './components/LogoutButton';

// Force dynamic rendering to handle live sessions safely on Vercel

export default async function AdminDashboardAndSetup() {
  // 1. Authenticate User (Super Admin Check)
  const session = await auth();
  
  if (!session || session.user?.email !== 'kent.bsece@gmail.com') {
    return (
      <div className="d-flex min-vh-100 justify-content-center align-items-center bg-dark">
        <div className="text-center card p-5 border-secondary shadow-lg bg-body">
          <i className="bi bi-shield-lock-fill text-danger fs-1 mb-3"></i>
          <h3 className="text-accent fw-bold">Super Admin Access Only</h3>
          <p className="text-secondary small">
            This module is strictly restricted to <b>System Administrator</b>.
          </p>
          <button className="btn btn-info fw-bold mt-3" data-bs-toggle="modal" data-bs-target="#otpAuthModal">
            Authenticate via OTP
          </button>
        </div>
      </div>
    );
  }

  // 2. Fetch Data and Set Environment
  const departments = await prisma.organization.findMany();
  const isProduction = Boolean(process.env.NODE_ENV === 'production' || process.env.VERCEL);

  const getDeptUrl = (subdomain: string) => {
    if (isProduction) {
      return `/department/${subdomain}`;
    }
    return `http://localhost:3000/department/${subdomain}`;
  };

  return (
    <div className="container py-5" style={{ maxWidth: '1200px' }}>
      <div className="d-flex justify-content-between align-items-center mb-5 border-bottom border-secondary pb-3">
        <h2 className="fw-bold text-accent m-0">
          <i className="bi bi-shield-check me-2"></i>CLEAR System Master Admin
        </h2>
        <div className="d-flex align-items-center gap-3">
          <span className="text-success fw-bold small d-none d-md-inline">
            <i className="bi bi-person-circle me-1"></i>{session.user.email}
          </span>
          <LogoutButton />
        </div>
      </div>

      <div className="row g-5">
        {/* LEFT COLUMN: Setup Form */}
        <div className="col-12 col-lg-4">
          <div className="card p-4 border-secondary shadow-lg bg-card sticky-top" style={{ top: '2rem' }}>
            <h5 className="fw-bold text-accent mb-1">
              <i className="bi bi-building-gear me-2"></i>Provision Department
            </h5>
            <p className="text-secondary small mb-4">Create or modify a College/Department.</p>
            <form action={async (formData) => {
              'use server';
              await createDepartment(formData);
            }}>
              <div className="mb-3">
                <label className="form-label text-secondary small fw-semibold">Department / College Name</label>
                <input type="text" name="name" placeholder="College of Engineering" className="form-control bg-body border-secondary" required />
              </div>
              <div className="mb-3">
                <label className="form-label text-secondary small fw-semibold">Subdomain Prefix</label>
                <input type="text" name="subdomain" placeholder="engineering" className="form-control bg-body border-secondary" required />
              </div>
              <button type="submit" className="btn btn-warning w-100 fw-bold py-2 shadow-sm">
                <i className="bi bi-plus-circle-fill me-2"></i>Provision Department
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Matrix */}
        <div className="col-12 col-lg-8">
          <h5 className="fw-bold text-accent mb-4">
            <i className="bi bi-grid-fill me-2"></i>Active Departments Matrix
          </h5>
          <div className="row g-4">
            {departments.map((dept) => (
              <div key={dept.id} className="col-12 col-sm-6 col-md-6">
                <Link href={getDeptUrl(dept.subdomain)} className="text-decoration-none">
                  <div className="card h-100 text-center border-secondary shadow-sm p-4 bg-card transition-all">
                    <h6 className="fw-bold text-color mb-1">{dept.name}</h6>
                    <small className="text-info">{isProduction ? `/department/${dept.subdomain}` : `http://localhost:3000/department/${dept.subdomain}`}</small>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}