// /app/dashboard/provisions/MasterProvisionForm.tsx
'use client';

import { useState } from 'react';
import { provisionEntityWithTier } from './actions';

export function MasterProvisionForm() {
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
      await provisionEntityWithTier({
        schoolGroup: formData.get('schoolGroup') as string,
        name: formData.get('name') as string,
        subdomain: formData.get('subdomain') as string,
        tier: formData.get('tier') as 'Freemium' | 'Pro' | 'Corporate',
        type: formData.get('type') as string,
        adminEmail: formData.get('adminEmail') as string,
        adminName: formData.get('adminName') as string,
      });

      setSuccess('Entity and initial administrator successfully provisioned!');
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
          <i className="bi bi-exclamation-triangle-fill me-1"></i> {error}
        </div>
      )}
      {success && (
        <div className="alert alert-success py-2 small mb-0">
          <i className="bi bi-check-circle-fill me-1"></i> {success}
        </div>
      )}

      <div>
        <label className="form-label text-uppercase small fw-bold text-info mb-1">
          School / Entity Group ID (e.g. fcu, cpu)
        </label>
        <input
          type="text"
          name="schoolGroup"
          required
          placeholder="fcu"
          className="form-control bg-dark text-white border-secondary"
        />
        <div className="form-text text-secondary" style={{ fontSize: '11px' }}>
          Groups affiliated entities together and enforces Freemium/Pro tier limits.
        </div>
      </div>

      <div>
        <label className="form-label text-uppercase small fw-bold text-info mb-1">
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
        <label className="form-label text-uppercase small fw-bold text-info mb-1">
          Unique Subdomain Slug
        </label>
        <input
          type="text"
          name="subdomain"
          required
          placeholder="fcu-engineering"
          className="form-control bg-dark text-white border-secondary font-monospace"
        />
      </div>

      <div className="row g-2">
        <div className="col-6">
          <label className="form-label text-uppercase small fw-bold text-info mb-1">
            Subscription Tier
          </label>
          <select
            name="tier"
            defaultValue="Freemium"
            className="form-select bg-dark text-white border-secondary"
          >
            <option value="Freemium">Freemium (Max 2)</option>
            <option value="Pro">Pro (Up to 10)</option>
            <option value="Corporate">Corporate (Unlim)</option>
          </select>
        </div>

        <div className="col-6">
          <label className="form-label text-uppercase small fw-bold text-info mb-1">
            Entity Type
          </label>
          <select
            name="type"
            defaultValue="Department"
            className="form-select bg-dark text-white border-secondary"
          >
            <option value="Department">Department</option>
            <option value="Organization">Organization</option>
            <option value="Administration">Administration</option>
          </select>
        </div>
      </div>

      <hr className="border-secondary my-1" />

      <div>
        <label className="form-label text-uppercase small fw-bold text-info mb-1">
          Initial Entity Admin Email
        </label>
        <input
          type="email"
          name="adminEmail"
          required
          placeholder="kent.bsece@gmail.com"
          className="form-control bg-dark text-white border-secondary"
        />
        <div className="form-text text-secondary" style={{ fontSize: '11px' }}>
          This email will have OTP login access at <code>/dashboard/entity/login</code>.
        </div>
      </div>

      <div>
        <label className="form-label text-uppercase small fw-bold text-info mb-1">
          Initial Admin Full Name
        </label>
        <input
          type="text"
          name="adminName"
          required
          placeholder="Engr. Kent"
          className="form-control bg-dark text-white border-secondary"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn btn-info fw-bold w-100 py-2 mt-2 shadow-sm text-dark"
      >
        {loading ? 'Provisioning Entity...' : 'Provision Entity & Admin'}
      </button>
    </form>
  );
}