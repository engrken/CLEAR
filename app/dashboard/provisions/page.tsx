// /app/dashboard/provisions/page.tsx
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { isSuperAdminEmail } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import { provisionEntityWithTier } from './actions';
import { ProvisionRow } from './ProvisionRow';

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
    <div className="p-6 max-w-7xl mx-auto space-y-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">SaaS Institutional Provisioning & Tiers</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Manage multi-tenant school groups, monitor tier limits (Freemium vs. Pro vs. Corporate), and provision new departments.
          </p>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Provision New Tenant Form */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 h-fit space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-3">
            Provision New Tenant
          </h2>
          
          <form action={async (formData) => {
            "use server";
            const name = formData.get("name") as string;
            const subdomain = formData.get("subdomain") as string;
            const schoolGroup = formData.get("schoolGroup") as string;
            const tier = formData.get("tier") as 'Freemium' | 'Pro' | 'Corporate';
            const type = formData.get("type") as string;

            await provisionEntityWithTier({ name, subdomain, schoolGroup, tier, type });
          }} className="space-y-4">
            
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                School Group ID (e.g. fcu, cpu)
              </label>
              <input 
                type="text" 
                name="schoolGroup" 
                required 
                placeholder="fcu"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                Used to group departments and enforce Freemium limits.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Department / Organization Name
              </label>
              <input 
                type="text" 
                name="name" 
                required 
                placeholder="College of Engineering"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Unique Subdomain Slug
              </label>
              <input 
                type="text" 
                name="subdomain" 
                required 
                placeholder="fcu-engineering"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Subscription Tier
              </label>
              <select 
                name="tier" 
                defaultValue="Freemium"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Freemium">Freemium (Max 2 per school)</option>
                <option value="Pro">Pro (Up to 10 tenants)</option>
                <option value="Corporate">Corporate (Unlimited)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                Entity Type
              </label>
              <select 
                name="type" 
                defaultValue="Department"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Department">Department / College</option>
                <option value="Student Organization">Student Council / Chapter</option>
                <option value="Administration">Main Administration</option>
              </select>
            </div>

            <button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-sm cursor-pointer"
            >
              Provision Entity
            </button>
          </form>
        </div>

        {/* Right Column: Existing Tenants Matrix */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-3">
            Registered Tenants ({organizations.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs uppercase bg-slate-100 dark:bg-slate-900">
                  <th className="p-3">School Group / Tenant</th>
                  <th className="p-3">Tier</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Stats</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {organizations.map((org) => (
                  <ProvisionRow key={org.id} org={org} />
                ))}
                {organizations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">
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
  );
}