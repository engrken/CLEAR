// /app/dashboard/provisions/page.tsx
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { isSuperAdminEmail } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import { provisionEntityWithTier } from './actions';
import { ProvisionRow } from './ProvisionRow';
import { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function ProvisionsPage() {
  const session = await auth();
  const email = String(session?.user?.email || '').trim().toLowerCase();
  
  if (!email || !isSuperAdminEmail(email)) {
    redirect('/dashboard');
  }

  const organizations = await prisma.organization.findMany({
    orderBy: [
      { schoolGroup: 'asc' },
      { name: 'asc' }
    ],
    include: {
      _count: {
        select: { students: true, collections: true, tenantUsers: true }
      }
    }
  });

  return (
    <div className="w-100 p-4 p-md-5 space-y-8" style={{ color: '#f8fafc' }}>
      {/* Header */}
      <div className="p-4 rounded-xl shadow-lg border border-slate-700 mb-6" style={{ backgroundColor: '#1e293b' }}>
        <h1 className="h3 fw-bold text-white mb-2">SaaS Institutional Provisioning & Tiers</h1>
        <p className="text-secondary small mb-0">
          Manage multi-tenant school groups, monitor tier limits (Freemium vs. Pro vs. Corporate), and provision new departments.
        </p>
      </div>

      {/* Main Grid */}
      <div className="row g-4">
        
        {/* Left Column: Provision New Tenant Form */}
        <div className="col-12 col-lg-4">
          <div className="p-4 rounded-xl shadow-lg border border-slate-700 h-100" style={{ backgroundColor: '#1e293b' }}>
            <h5 className="fw-bold text-white border-bottom border-slate-700 pb-3 mb-4">
              Provision New Tenant
            </h5>
            
            <form action={async (formData) => {
              "use server";
              const name = formData.get("name") as string;
              const subdomain = formData.get("subdomain") as string;
              const schoolGroup = formData.get("schoolGroup") as string;
              const tier = formData.get("tier") as 'Freemium' | 'Pro' | 'Corporate';
              const type = formData.get("type") as string;

              await provisionEntityWithTier({ name, subdomain, schoolGroup, tier, type });
            }} className="vstack gap-3">
              
              <div>
                <label className="form-label text-uppercase small fw-bold text-info">
                  School Group ID (e.g. fcu, cpu)
                </label>
                <input 
                  type="text" 
                  name="schoolGroup" 
                  required 
                  placeholder="fcu"
                  className="form-control bg-dark text-white border-secondary"
                />
                <div className="form-text text-secondary" style={{ fontSize: '11px' }}>
                  Used to group departments and enforce Freemium limits.
                </div>
              </div>

              <div>
                <label className="form-label text-uppercase small fw-bold text-info">
                  Department / Organization Name
                </label>
                <input 
                  type="text" 
                  name="name" 
                  required 
                  placeholder="College of Engineering"
                  className="form-control bg-dark text-white border-secondary"
                />
              </div>

              <div>
                <label className="form-label text-uppercase small fw-bold text-info">
                  Unique Subdomain Slug
                </label>
                <input 
                  type="text" 
                  name="subdomain" 
                  required 
                  placeholder="fcu-engineering"
                  className="form-control bg-dark text-white border-secondary"
                />
              </div>

              <div>
                <label className="form-label text-uppercase small fw-bold text-info">
                  Subscription Tier
                </label>
                <select 
                  name="tier" 
                  defaultValue="Freemium"
                  className="form-select bg-dark text-white border-secondary"
                >
                  <option value="Freemium">Freemium (Max 2 per school)</option>
                  <option value="Pro">Pro (Up to 10 tenants)</option>
                  <option value="Corporate">Corporate (Unlimited)</option>
                </select>
              </div>

              <div>
                <label className="form-label text-uppercase small fw-bold text-info">
                  Entity Type
                </label>
                <select 
                  name="type" 
                  defaultValue="Department"
                  className="form-select bg-dark text-white border-secondary"
                >
                  <option value="Department">Department / College</option>
                  <option value="Student Organization">Student Council / Chapter</option>
                  <option value="Administration">Main Administration</option>
                </select>
              </div>

              <button 
                type="submit" 
                className="btn btn-info fw-bold w-150 py-2 mt-2 shadow-sm text-dark"
              >
                Provision Entity
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Existing Tenants Matrix */}
        <div className="col-12 col-lg-8">
          <div className="p-4 rounded-xl shadow-lg border border-slate-700 h-100" style={{ backgroundColor: '#1e293b' }}>
            <h5 className="fw-bold text-white border-bottom border-slate-700 pb-3 mb-4">
              Registered Tenants ({organizations.length})
            </h5>

            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle mb-0 text-start" style={{ backgroundColor: 'transparent' }}>
                <thead>
                  <tr className="text-secondary small text-uppercase border-bottom border-slate-700">
                    <th className="py-3">School Group / Tenant</th>
                    <th className="py-3">Tier</th>
                    <th className="py-3">Status</th>
                    <th className="py-3">Stats</th>
                    <th className="py-3 text-end">Actions</th>
                  </tr>
                </thead>
                <tbody className="border-top-0">
                  {organizations.map((org) => (
                    <ProvisionRow key={org.id} org={org} />
                  ))}
                  {organizations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-5 text-center text-secondary">
                        No organizations provisioned yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}