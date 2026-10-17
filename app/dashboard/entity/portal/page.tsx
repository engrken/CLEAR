// /app/dashboard/entity/portal/page.tsx
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function EntityPortalPage() {
  const session = await auth();
  const email = String(session?.user?.email || '').trim().toLowerCase();

  const tenantUser = await prisma.tenantUser.findFirst({
    where: { email },
    include: { organization: true }
  });

  if (!tenantUser || tenantUser.role !== 'admin') {
    redirect('/dashboard');
  }

  const schoolGroup = tenantUser.organization.schoolGroup;

  const entityGroupOrgs = await prisma.organization.findMany({
    where: { schoolGroup },
    include: {
      _count: {
        select: { students: true, collections: true }
      }
    }
  });

  const currentTier = tenantUser.organization.tier;
  const maxAllowed = currentTier === 'Freemium' ? 2 : currentTier === 'Pro' ? 10 : 999;
  const canAddMore = entityGroupOrgs.length < maxAllowed;

  return (
    <div className="container py-5 text-white" style={{ maxWidth: '1000px' }}>
      {/* Header Banner */}
      <div className="card bg-dark border-secondary p-4 mb-4 shadow-sm">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <span className="badge bg-info text-dark mb-2 fw-bold uppercase">Entity Group ID: {schoolGroup}</span>
            <h2 className="fw-bold mb-1">Entity Management Portal</h2>
            <p className="text-secondary small mb-0">Manage associated entities and track tier resource allocation.</p>
          </div>
          <div className="text-end bg-secondary bg-opacity-10 border border-secondary p-3 rounded">
            <div className="small text-secondary text-uppercase fw-bold">Subscription Tier</div>
            <div className="fs-5 fw-bold text-info">{currentTier}</div>
            <div className="small text-secondary">{entityGroupOrgs.length} / {maxAllowed === 999 ? 'Unlimited' : maxAllowed} Entities Used</div>
          </div>
        </div>
      </div>

      {!canAddMore && (
        <div className="alert alert-warning border-0 shadow-sm mb-4">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          You have reached the maximum entity limit for your <strong>{currentTier}</strong> tier.
        </div>
      )}

      <div className="row g-4">
        {/* Left Column: Provision New Entity Form */}
        <div className="col-12 col-md-5">
          <div className="card bg-dark border-secondary p-4 shadow-sm h-100">
            <h5 className="fw-bold border-bottom border-secondary pb-3 mb-3">Add New Entity Workspace</h5>
            
            <form action={async (formData) => {
              "use server";
              const { provisionEntityWithTier } = await import('@/app/dashboard/provisions/actions');
              const name = formData.get("name") as string;
              const subdomain = formData.get("subdomain") as string;
              const type = formData.get("type") as string;

              await provisionEntityWithTier({
                name,
                subdomain,
                schoolGroup,
                tier: currentTier,
                type
              });
            }} className="vstack gap-3">
              
              <div>
                <label className="form-label small text-secondary fw-bold uppercase">Entity Name</label>
                <input 
                  type="text" 
                  name="name" 
                  required 
                  placeholder="College of Engineering"
                  className="form-control bg-dark text-white border-secondary"
                />
              </div>

              <div>
                <label className="form-label small text-secondary fw-bold uppercase">Subdomain Slug</label>
                <input 
                  type="text" 
                  name="subdomain" 
                  required 
                  placeholder="fcu-engineering"
                  className="form-control bg-dark text-white border-secondary"
                />
              </div>

              <div>
                <label className="form-label small text-secondary fw-bold uppercase">Entity Type</label>
                <select name="type" className="form-select bg-dark text-white border-secondary">
                  <option value="Department">Department / College</option>
                  <option value="Student Organization">Student Council / Chapter</option>
                  <option value="Administration">Main Administration</option>
                </select>
              </div>

              <button 
                type="submit" 
                disabled={!canAddMore}
                className={`btn fw-bold py-2 mt-2 ${canAddMore ? 'btn-info text-dark' : 'btn-secondary disabled'}`}
              >
                Provision Entity
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Entity List Table */}
        <div className="col-12 col-md-7">
          <div className="card bg-dark border-secondary p-4 shadow-sm h-100">
            <h5 className="fw-bold border-bottom border-secondary pb-3 mb-3">Associated Group Entities</h5>
            
            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle text-start mb-0">
                <thead>
                  <tr className="text-secondary small text-uppercase">
                    <th>Entity</th>
                    <th>Type</th>
                    <th>Students</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {entityGroupOrgs.map((org) => (
                    <tr key={org.id}>
                      <td>
                        <div className="fw-bold">{org.name}</div>
                        <div className="small text-info font-monospace">/{org.subdomain}</div>
                      </td>
                      <td>
                        <span className="badge bg-secondary text-light">{org.type}</span>
                      </td>
                      <td className="small text-secondary">
                        {org._count.students} Enrolled
                      </td>
                      <td className="text-end">
                        <Link href={`/department/${org.subdomain}`} className="btn btn-sm btn-outline-info">
                          Manage <i className="bi bi-box-arrow-in-right ms-1"></i>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}