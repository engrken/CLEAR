// /app/dashboard/provisions/ProvisionRow.tsx
'use client';

import { updateOrganizationTier, updateOrganizationStatus, deleteOrganization } from './actions';

export function ProvisionRow({ org }: { org: any }) {
  return (
    <tr className="hover:bg-gray-50/50 transition">
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
  );
}