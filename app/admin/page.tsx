import { auth } from '@/auth'; 
import { createDepartment } from './actions';
import Link from 'next/link';
import LogoutButton from './components/LogoutButton';

export default async function AdminSetupPage() {
  const session = await auth();
  
  // Define isProduction here to resolve the TypeScript error
  const isProduction = Boolean(process.env.NODE_ENV === 'production' || process.env.VERCEL);
  
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

  return (
    <div className="container py-5" style={{ maxWidth: '600px' }}>
      <div className="mb-4">
        <Link href="/admin" className="text-info text-decoration-none small fw-bold">
          <i className="bi bi-arrow-left me-1"></i>Back to Dashboard
        </Link>
      </div>

      <div className="card p-4 border-secondary shadow-lg bg-card">
        <div className="d-flex justify-content-between align-items-start mb-3">
          <h3 className="fw-bold text-accent m-0">
            <i className="bi bi-building-gear me-2"></i>Department Setup
          </h3>
          <LogoutButton />
        </div>
        
        <p className="text-secondary small mb-4">
          Create, modify, or delete College / Department. <br />
          Authenticated as: <span className="text-success fw-bold">{session.user.email}</span>
        </p>

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
              <span className="input-group-text border-secondary bg-dark text-secondary">
                {isProduction ? '.clearsys.vercel.app' : '.localhost:3000'}
              </span>
            </div>
            <div className="form-text text-secondary" style={{ fontSize: '0.75rem' }}>Logo file must be named accordingly (e.g., nursing_logo.png).</div>
          </div>

          <div className="mb-4">
            <label className="form-label text-secondary small fw-semibold">Department Code / Acronym</label>
            <input type="text" name="code" className="form-control bg-body text-color border-secondary" placeholder="e.g. CON" required />
          </div>

          <button type="submit" className="btn btn-warning w-100 fw-bold py-2 shadow-sm">
            Provision New Department
          </button>
        </form>
      </div>
    </div>
  );
}