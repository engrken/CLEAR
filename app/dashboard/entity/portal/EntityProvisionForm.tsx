// /app/dashboard/entity/portal/EntityProvisionForm.tsx
'use client';

import { useState } from 'react';
import { provisionSubEntityAction } from '../actions';

export function EntityProvisionForm({
  schoolGroup,
  currentTier,
  canAddMore,
}: {
  schoolGroup: string;
  currentTier: string;
  canAddMore: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      await provisionSubEntityAction(formData);
      setSuccess('New entity workspace provisioned! You have been assigned as its administrator.');
      form.reset();
    } catch (err: any) {
      setError(err.message || 'Failed to provision entity.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="vstack gap-3">
      {error && (
        <div className="alert alert-danger py-2 small mb-0">
          <i className="bi bi-exclamation-octagon me-1"></i> {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success py-2 small mb-0">
          <i className="bi bi-check-circle me-1"></i> {success}
        </div>
      )}

      {schoolGroup === 'default-school' && (
        <div>
          <label className="form-label small text-warning fw-bold text-uppercase">
            Set Institutional Group ID (e.g. fcu, cpu)
          </label>
          <input
            type="text"
            name="schoolGroup"
            required
            placeholder="school"
            className="form-control bg-dark text-white border-warning"
          />
          <div className="form-text text-secondary" style={{ fontSize: '11px' }}>
            Your current entity is under <code>default-school</code>. Assign a unique school code to link your entities together.
          </div>
        </div>
      )}

      <div>
        <label className="form-label small text-info fw-bold text-uppercase">
          Your Department / Organization
        </label>
        <input
          type="text"
          name="name"
          required
          disabled={!canAddMore || loading}
          placeholder="College of Engineering"
          className="form-control bg-dark text-white border-secondary"
        />
      </div>

      <div>
        <label className="form-label small text-info fw-bold text-uppercase">
          Subdomain (/department/subdomain)
        </label>
        <input
          type="text"
          name="subdomain"
          required
          disabled={!canAddMore || loading}
          placeholder="coe"
          className="form-control bg-dark text-white border-secondary font-monospace"
        />
      </div>

      <div>
        <label className="form-label small text-info fw-bold text-uppercase">
          Entity Type
        </label>
        <select
          name="type"
          disabled={!canAddMore || loading}
          className="form-select bg-dark text-white border-secondary"
        >
          <option value="Department">Department / College</option>
          <option value="Organization">Student Chapter / Organization</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={!canAddMore || loading}
        className={`btn fw-bold py-2 mt-2 ${
          canAddMore ? 'btn-info text-dark shadow-sm' : 'btn-secondary disabled'
        }`}
      >
        {loading
          ? 'Provisioning Workspace...'
          : canAddMore
          ? 'Provision Entity Workspace'
          : `Limit Reached (${currentTier})`}
      </button>
    </form>
  );
}