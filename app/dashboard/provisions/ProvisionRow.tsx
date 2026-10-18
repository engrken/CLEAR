// /app/dashboard/provisions/ProvisionRow.tsx
'use client';
import { clearAlert, clearConfirm, clearPrompt } from "@/lib/clear-dialogs";


import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateOrganizationTier,
  updateOrganizationStatus,
  updateOrganizationSchoolGroup,
  deleteOrganization,
  type OrganizationStatus,
  type SubscriptionTier,
} from './actions';

type OrganizationRow = {
  id: string;
  name: string;
  subdomain: string;
  schoolGroup?: string | null;
  tier: string;
  status: string;
  _count: { students: number; collections: number; tenantUsers: number };
};

export function ProvisionRow({ org }: { org: OrganizationRow }) {
  const router = useRouter();
  const [editingGroup, setEditingGroup] = useState(false);
  const [groupValue, setGroupValue] = useState(org.schoolGroup || 'default-school');
  const [tier, setTier] = useState(org.tier);
  const [status, setStatus] = useState(org.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setGroupValue(org.schoolGroup || 'default-school');
    setTier(org.tier);
    setStatus(org.status);
  }, [org.schoolGroup, org.status, org.tier]);

  async function execute(action: () => Promise<unknown>, onSuccess?: () => void) {
    if (busy) return false;
    setBusy(true);
    setError('');
    try {
      await action();
      onSuccess?.();
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this change.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function changeTier(proposed: SubscriptionTier) {
    const previous = tier;
    if (proposed === previous) return;
    if (org.schoolGroup && org.schoolGroup !== 'default-school') {
      if (!await clearConfirm(`Set ${org.schoolGroup} and ALL its entities to the ${proposed} tier? Tier limits will be checked.`)) return;
    }
    setTier(proposed);
    if (!await execute(() => updateOrganizationTier(org.id, proposed))) setTier(previous);
  }

  async function changeStatus(proposed: OrganizationStatus) {
    const previous = status;
    if (proposed === previous) return;
    if (proposed !== 'Active' && !await clearConfirm(`Change ${org.name} to ${proposed}? Its users may lose access.`)) return;
    setStatus(proposed);
    if (!await execute(() => updateOrganizationStatus(org.id, proposed))) setStatus(previous);
  }

  async function confirmDelete() {
    const answer = await clearPrompt(
      `WARNING: Permanently deleting ${org.name} removes its owner account. Financial or student data blocks deletion.\nType ${org.subdomain} to confirm.`,
    );
    if (answer === null) return;
    if (answer !== org.subdomain) {
      setError('Deletion cancelled: typed subdomain did not match.');
      return;
    }
    await execute(() => deleteOrganization(org.id));
  }

  return (
    <tr className="border-bottom border-secondary border-opacity-25">
      <td className="py-3 align-top">
        <div className="fw-bold text-body">{org.name}</div>
        <div className="small text-info font-monospace">/department/{org.subdomain}</div>
        {!editingGroup ? (
          <div className="d-flex gap-2 align-items-center mt-1">
            <span className="badge bg-secondary text-light">Group: {org.schoolGroup || 'default-school'}</span>
            <button type="button" className="btn btn-link btn-sm p-0" disabled={busy}
              onClick={() => setEditingGroup(true)}>Edit</button>
          </div>
        ) : (
          <form className="d-flex gap-1 align-items-center mt-1" onSubmit={async (event) => {
            event.preventDefault();
            const proposed = groupValue.trim().toLowerCase();
            if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(proposed)) {
              setError('Enter a valid group: lowercase letters, numbers, internal hyphens (1–63 characters).');
              return;
            }
            if (proposed !== (org.schoolGroup || 'default-school') &&
                !await clearConfirm('Move this tenant to the selected school group? It will adopt the target group’s existing tier.')) return;
            void execute(() => updateOrganizationSchoolGroup(org.id, proposed), () => setEditingGroup(false));
          }}>
            <input className="form-control form-control-sm" value={groupValue}
              onChange={(event) => setGroupValue(event.target.value)} maxLength={63} disabled={busy} />
            <button type="submit" className="btn btn-sm btn-info" disabled={busy}>Save</button>
            <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy}
              onClick={() => { setGroupValue(org.schoolGroup || 'default-school'); setEditingGroup(false); }}>Cancel</button>
          </form>
        )}
        {error && <div role="alert" className="text-danger small mt-2">{error}</div>}
      </td>
      <td className="py-3 align-top">
        <label className="visually-hidden" htmlFor={`tier-${org.id}`}>Subscription tier</label>
        <select id={`tier-${org.id}`} className="form-select form-select-sm" style={{ minWidth: 125 }}
          value={tier} disabled={busy} onChange={(event) => void changeTier(event.target.value as SubscriptionTier)}>
          <option value="Freemium">Freemium</option>
          <option value="Pro">Pro</option>
          <option value="Corporate">Corporate</option>
        </select>
      </td>
      <td className="py-3 align-top">
        <label className="visually-hidden" htmlFor={`status-${org.id}`}>Organization status</label>
        <select id={`status-${org.id}`} className="form-select form-select-sm" style={{ minWidth: 120 }}
          value={status} disabled={busy} onChange={(event) => void changeStatus(event.target.value as OrganizationStatus)}>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Archived">Archived</option>
        </select>
      </td>
      <td className="py-3 align-top small text-secondary">
        <div>Students: <strong>{org._count.students}</strong></div>
        <div>Collections: <strong>{org._count.collections}</strong></div>
        <div>Users: <strong>{org._count.tenantUsers}</strong></div>
      </td>
      <td className="py-3 align-top text-end">
        <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy}
          onClick={() => void confirmDelete()}>{busy ? 'Processing...' : 'Delete'}</button>
      </td>
    </tr>
  );
}
