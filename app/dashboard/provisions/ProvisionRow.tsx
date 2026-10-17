// /app/dashboard/provisions/ProvisionRow.tsx
'use client';

import { useState } from 'react';
import {
  updateOrganizationTier,
  updateOrganizationStatus,
  updateOrganizationSchoolGroup,
  deleteOrganization,
} from './actions';

export function ProvisionRow({ org }: { org: any }) {
  const [editingGroup, setEditingGroup] = useState(false);
  const [groupVal, setGroupVal] = useState(org.schoolGroup || 'default-school');

  return (
    <tr className="border-bottom border-secondary border-opacity-25">
      <td className="py-3 align-top">
        <div className="fw-bold text-white">{org.name}</div>
        <div className="small text-info font-monospace">/department/{org.subdomain}</div>

        {/* Editable School Group Pill */}
        {!editingGroup ? (
          <div className="mt-1 d-flex align-items-center gap-2">
            <span className="badge bg-secondary bg-opacity-25 text-light border border-secondary font-monospace">
              Group: {org.schoolGroup}
            </span>
            <button
              type="button"
              onClick={() => setEditingGroup(true)}
              className="btn btn-link btn-sm p-0 text-secondary text-decoration-none"
              style={{ fontSize: '11px' }}
            >
              <i className="bi bi-pencil-square"></i> Edit
            </button>
          </div>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await updateOrganizationSchoolGroup(org.id, groupVal);
              setEditingGroup(false);
            }}
            className="d-flex align-items-center gap-1 mt-1"
          >
            <input
              type="text"
              value={groupVal}
              onChange={(e) => setGroupVal(e.target.value)}
              className="form-control form-control-sm bg-dark text-white border-info font-monospace"
              style={{ width: '130px', fontSize: '11px' }}
            />
            <button type="submit" className="btn btn-sm btn-info text-dark py-0 px-2">
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setGroupVal(org.schoolGroup);
                setEditingGroup(false);
              }}
              className="btn btn-sm btn-outline-secondary py-0 px-1"
            >
              ✕
            </button>
          </form>
        )}
      </td>

      {/* Tier Selector Action */}
      <td className="py-3 align-top">
        <form
          action={async (formData) => {
            const newTier = formData.get('tier') as 'Freemium' | 'Pro' | 'Corporate';
            await updateOrganizationTier(org.id, newTier);
          }}
        >
          <select
            name="tier"
            defaultValue={org.tier}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="form-select form-select-sm bg-dark text-white border-secondary fw-semibold"
            style={{ width: '130px' }}
          >
            <option value="Freemium">Freemium</option>
            <option value="Pro">Pro</option>
            <option value="Corporate">Corporate</option>
          </select>
        </form>
      </td>

      {/* Status Toggle Action */}
      <td className="py-3 align-top">
        <form
          action={async (formData) => {
            const newStatus = formData.get('status') as 'Active' | 'Inactive' | 'Archived';
            await updateOrganizationStatus(org.id, newStatus);
          }}
        >
          <select
            name="status"
            defaultValue={org.status}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className={`form-select form-select-sm bg-dark fw-semibold ${
              org.status === 'Active'
                ? 'text-success border-success'
                : 'text-danger border-danger'
            }`}
            style={{ width: '115px' }}
          >
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Archived">Archived</option>
          </select>
        </form>
      </td>

      <td className="py-3 align-top small text-secondary">
        <div>Students: <strong className="text-light">{org._count.students}</strong></div>
        <div>Collections: <strong className="text-light">{org._count.collections}</strong></div>
        <div>Users: <strong className="text-light">{org._count.tenantUsers}</strong></div>
      </td>

      <td className="py-3 align-top text-end">
        <form
          action={async () => {
            await deleteOrganization(org.id);
          }}
        >
          <button
            type="submit"
            className="btn btn-sm btn-outline-danger"
            onClick={(e) => {
              if (
                !confirm(
                  `Are you sure you want to permanently delete "${org.name}" and all its associated data?`
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <i className="bi bi-trash3 me-1"></i> Delete
          </button>
        </form>
      </td>
    </tr>
  );
}