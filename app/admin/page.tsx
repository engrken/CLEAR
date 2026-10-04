// app/admin/page.tsx
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function AdminDashboard() {
  const departments = await prisma.organization.findMany();

  // Helper to determine whether to use production paths or local subdomains
  const getDeptUrl = (subdomain: string) => {
    const isProduction = Boolean(process.env.NODE_ENV === 'production' || process.env.VERCEL);
    if (isProduction) {
      return `/department/${subdomain}`;
    }
    return `http://${subdomain}.localhost:3000`;
  };

  const isProduction = Boolean(process.env.NODE_ENV === 'production' || process.env.VERCEL);

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-5 border-bottom border-secondary pb-3">
        <h2 className="fw-bold text-accent m-0">
          <i className="bi bi-grid-fill me-2"></i>CLEAR System Dashboard
        </h2>
        <Link href="/admin/departments" className="btn btn-warning fw-bold shadow-sm">
          <i className="bi bi-gear-fill me-2"></i>Manage Departments
        </Link>
      </div>

      <div className="row g-4">
        {departments.map((dept) => {
          const deptUrl = getDeptUrl(dept.subdomain);
          const cardContent = (
            <div className="card h-100 text-center border-secondary shadow-sm app-card-hover p-4 bg-card transition-all">
              {/* 2" x 2" Logo (192px) - Clean root path without /public/ */}
              <div className="mx-auto mb-3" style={{ width: '192px', height: '192px' }}>
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
            <div key={dept.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
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
      </div>
    </div>
  );
}