// /app/dashboard/provisions/page.tsx
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { isSuperAdminEmail } from '@/lib/permissions';
import { redirect } from 'next/navigation';
import { 
  provisionEntityWithTier, 
  updateOrganizationTier, 
  updateOrganizationStatus, 
  deleteOrganization 
} from './actions';

export default async function ProvisionsPage() {
  const session = await auth();
  const email = String(session?.user?.email || '').trim().toLowerCase();
  
  if (!email || !isSuperAdminEmail(email)) {
    redirect('/dashboard');
  }

  // Fetch all organizations grouped/ordered by schoolGroup
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
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">SaaS Institutional Provisioning & Tiers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage multi-tenant school groups, monitor tier limits (Freemium vs. Pro vs. Corporate), and provision new departments.
          </p>
        </div>
      </div>

      {/* Main Grid: Provisioning Form & Existing Tenants Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Provision New Tenant Form */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 h-fit space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-3">Provision New Tenant</h2>
          
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
              <label className="block text-xs font-medium text-gray-700 uppercase mb-1">School Group ID (e.g. fcu, cpu)</label>
              <input 
                type="text" 
                name="schoolGroup" 
                required 
                placeholder="fcu"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span className="text-[11px] text-gray-400">Used to group departments and enforce Freemium limits.</span>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Department / Organization Name</label>
              <input 
                type="text" 
                name="name" 
                required 
                placeholder="College of Engineering"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Unique Subdomain Slug</label>
              <input 
                type="text" 
                name="subdomain" 
                required 
                placeholder="fcu-engineering"
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Subscription Tier</label>
              <select 
                name="tier" 
                defaultValue="Freemium"
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Freemium">Freemium (Max 2 per school)</option>
                <option value="Pro">Pro (Up to 10 tenants)</option>
                <option value="Corporate">Corporate (Unlimited)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 uppercase mb-1">Entity Type</label>
              <select 
                name="type" 
                defaultValue="Department"
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Department">Department / College</option>
                <option value="Student Organization">Student Council / Chapter</option>
                <option value="Administration">Main Administration</option>
              </select>
            </div>

            <button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-sm"
            >
              Provision Entity
            </button>
          </form>
        </div>

        {/* Right Column: Existing Tenants Matrix */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 border-b pb-3">
            Registered Tenants ({organizations.length})
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b text-gray-500 text-xs uppercase bg-gray-50">
                  <th className="p-3">School Group / Tenant</th>
                  <th className="p-3">Tier</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Stats</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-50/50 transition">
                    <td className="p-3 align-top">
                      <div className="font-semibold text-gray-900">{org.name}</div>
                      <div className="text-xs text-blue-600 font-mono">subdomain: {org.subdomain}</div>
                      <div className="inline-block mt-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded-full font-mono">
                        Group: {org.schoolGroup}
                      </div>
                    </td>

                    {/* Tier Selector Action */}
                    <td className="p-3 align-top">
                      <form action={async (formData) => {
                        "use server";
                        const newTier = formData.get("tier") as 'Freemium' | 'Pro' | 'Corporate';
                        await updateOrganizationTier(org.id, newTier);
                      }}>
                        <select 
                          name="tier" 
                          defaultValue={org.tier}
                          onChange={(e) => e.currentTarget.form?.requestSubmit()}
                          className={`text-xs font-medium px-2 py-1 rounded-md border outline-none cursor-pointer ${
                            org.tier === 'Corporate' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                            org.tier === 'Pro' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-gray-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          <option value="Freemium">Freemium</option>
                          <option value="Pro">Pro</option>
                          <option value="Corporate">Corporate</option>
                        </select>
                      </form>
                    </td>

                    {/* Status Toggle Action */}
                    <td className="p-3 align-top">
                      <form action={async (formData) => {
                        "use server";
                        const newStatus = formData.get("status") as 'Active' | 'Inactive' | 'Archived';
                        await updateOrganizationStatus(org.id, newStatus);
                      }}>
                        <select 
                          name="status" 
                          defaultValue={org.status}
                          onChange={(e) => e.currentTarget.form?.requestSubmit()}
                          className={`text-xs px-2 py-1 rounded-md border outline-none cursor-pointer ${
                            org.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' :
                            'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                          <option value="Archived">Archived</option>
                        </select>
                      </form>
                    </td>

                    <td className="p-3 align-top text-xs text-gray-500">
                      <div>Students: {org._count.students}</div>
                      <div>Collections: {org._count.collections}</div>
                      <div>Users: {org._count.tenantUsers}</div>
                    </td>

                    <td className="p-3 align-top text-right">
                      <form action={async () => {
                        "use server";
                        await deleteOrganization(org.id);
                      }}>
                        <button 
                          type="submit" 
                          className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 rounded hover:bg-red-50 transition"
                          onClick={(e) => {
                            if (!confirm(`Are you sure you want to permanently delete "${org.name}" and all its associated data?`)) {
                              e.preventDefault();
                            }
                          }}
                        >
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {organizations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-gray-400 text-sm">
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