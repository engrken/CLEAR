// app/admin/page.tsx
import { auth } from '@/auth'; 
import { prisma } from '@/lib/prisma';
import { createDepartment } from './actions';
import Link from 'next/link';
import LogoutButton from './components/LogoutButton';

// Force dynamic rendering to handle live sessions safely on Vercel
export const dynamic = 'force-dynamic';

export default async function AdminDashboardAndSetup() {
  // 1. Authenticate User (Super Admin Check)
  const session = await auth();
  
  if (!session || session.user?.email !== 'kent.bsece@gmail.com') {
    return (
      <div className="d-flex min-vh-100 justify-content-center align-items-center">
        <div className="text-center card p-5 border-secondary shadow-lg">
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

  // Helper for dynamic paths
  const getDeptUrl = (subdomain: string) => {
    if (isProduction) {
      return `/department/${subdomain}`;
    }
    return `http://${subdomain}.localhost:3000`;
  };

  return (
    <div className="container py-5" style={{ maxWidth: '1200px' }}>
      
      {/* Top Header */}
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
        
        {/* LEFT COLUMN: Department Setup Form */}
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
                <input type="text" name="name" className="form-control bg-body text-color border-secondary" placeholder="e.g. College of Nursing" required />
              </div>

              <div className="mb-3">
                <label className="form-label text-secondary small fw-semibold">Subdomain Prefix</label>
                <div className="input-group">
                  <input type="text" name="subdomain" className="form-control bg-body text-color border-secondary" placeholder="nursing" required />
                </div>
                <div className="form-text text-secondary mt-1" style={{ fontSize: '0.75rem' }}>
                  Suffix: <span className="text-info fw-bold">{isProduction ? '.clearsys.vercel.app' : '.localhost:3000'}</span><br/>
                  Logo File: <code>[prefix]_logo.png</code>
                </div>
              </div>

              <div className="mb-4">
                <label className="form-label text-secondary small fw-semibold">Department Code / Acronym</label>
                <input type="text" name="code" className="form-control bg-body text-color border-secondary" placeholder="e.g. CON" required />
              </div>

              <button type="submit" className="btn btn-warning w-100 fw-bold py-2 shadow-sm">
                <i className="bi bi-plus-circle-fill me-2"></i>Provision Department
              </button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Dashboard Grid */}
        <div className="col-12 col-lg-8">
          <h5 className="fw-bold text-accent mb-4">
            <i className="bi bi-grid-fill me-2"></i>Active Departments Matrix
          </h5>
          
          <div className="row g-4">
            {departments.map((dept) => {
              const deptUrl = getDeptUrl(dept.subdomain);
              
              const cardContent = (
                <div className="card h-100 text-center border-secondary shadow-sm app-card-hover p-4 bg-card transition-all">
                  <div className="mx-auto mb-3" style={{ width: '128px', height: '128px' }}>
                    <img
                      src={`/${dept.subdomain}_logo.png`}
                      alt={`${dept.name} Logo`}
                      className="w-100 h-100 object-fit-contain"
                    />
                  </div>
                  <h6 className="fw-bold text-color mb-1">{dept.name}</h6>
                  <small className="text-info">
                    {isProduction ? `/department/${dept.subdomain}` : `${dept.subdomain}.localhost:3000`}
                  </small>
                </div>
              );

              return (
                <div key={dept.id} className="col-12 col-sm-6 col-md-6">
                  {isProduction ? (
                    <Link href={deptUrl} className="text-decoration-none">
                      {cardContent}
                    </Link>
                  ) : (
                    <a href={deptUrl} className="text-decoration-none">
                      {cardContent}
                    </a>
                  )}
                </div>
              );
            })}
            
            {departments.length === 0 && (
              <div className="col-12 text-center py-5 text-secondary border border-secondary rounded border-dashed">
                <i className="bi bi-inbox fs-1 d-block mb-2 text-muted"></i>
                No departments provisioned yet.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}