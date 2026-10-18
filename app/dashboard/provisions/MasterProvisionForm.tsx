// /app/dashboard/provisions/MasterProvisionForm.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { provisionEntityWithTier, type SubscriptionTier } from './actions';
import { periodsFor, type CalendarMode } from '@/lib/academic-periods';
import Link from 'next/link';

export function MasterProvisionForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [nextStep, setNextStep] = useState<string | null>(null);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>('Semester');
  const [includeSummer, setIncludeSummer] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setLoading(true);
    setError('');
    setSuccess('');
    setNextStep(null);
    try {
      const result = await provisionEntityWithTier({
        schoolGroup: String(formData.get('schoolGroup') || ''),
        name: String(formData.get('name') || ''),
        subdomain: String(formData.get('subdomain') || ''),
        tier: String(formData.get('tier') || 'Freemium') as SubscriptionTier,
        type: String(formData.get('type') || ''),
        adminEmail: String(formData.get('adminEmail') || ''),
        adminName: String(formData.get('adminName') || ''),
        initialAcademicYear: String(formData.get('initialAcademicYear') || ''),
        calendarMode,
        includeSummer: calendarMode === 'Semester' && includeSummer,
      });
      setSuccess(result.message);
      setNextStep(`/department/${encodeURIComponent(result.department)}/setup?ay=${encodeURIComponent(result.academicYear)}&term=${encodeURIComponent(result.activeTerm)}`);
      form.reset();
      setCalendarMode('Semester');
      setIncludeSummer(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to provision entity.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="vstack gap-3">
      {error && <div role="alert" className="alert alert-danger py-2 small mb-0">{error}</div>}
      {success && <div role="status" className="alert alert-success py-2 small mb-0">
        <div>{success}</div>
        {nextStep && <div className="mt-2"><Link href={nextStep} className="btn btn-sm btn-outline-success fw-semibold">Open Initial Tenant Setup <i className="bi bi-arrow-right ms-1" /></Link></div>}
        <small className="d-block mt-2">Use the new tenant administrator's OTP session to access its protected setup pages. The master provisioner's session does not replace tenant login.</small>
      </div>}
      <div>
        <label htmlFor="provision-school-group" className="form-label text-uppercase small fw-bold text-info mb-1">
          School / Entity Group ID
        </label>
        <input id="provision-school-group" name="schoolGroup" type="text" required maxLength={63}
          pattern="[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?" placeholder="school" autoComplete="off"
          className="form-control bg-dark text-white border-secondary" />
        <div className="form-text text-secondary small">Existing school groups must keep their current tier. Freemium: 2 entities; Pro: 10.</div>
      </div>
      <div>
        <label htmlFor="provision-name" className="form-label text-uppercase small fw-bold text-info mb-1">Department / Organization Name</label>
        <input id="provision-name" name="name" type="text" required maxLength={150} placeholder="College of..."
          className="form-control bg-dark text-white border-secondary" />
      </div>
      <div>
        <label htmlFor="provision-subdomain" className="form-label text-uppercase small fw-bold text-info mb-1">Unique Subdomain</label>
        <input id="provision-subdomain" name="subdomain" type="text" required maxLength={63}
          pattern="[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?" placeholder="school-dept" autoComplete="off"
          className="form-control bg-dark text-white border-secondary font-monospace" />
      </div>
      <div className="row g-2">
        <div className="col-6">
          <label htmlFor="provision-tier" className="form-label text-uppercase small fw-bold text-info mb-1">Subscription Tier</label>
          <select id="provision-tier" name="tier" defaultValue="Freemium" className="form-select bg-dark text-white border-secondary">
            <option value="Freemium">Freemium (Max 2)</option>
            <option value="Pro">Pro (Max 10)</option>
            <option value="Corporate">Corporate (Unlimited)</option>
          </select>
        </div>
        <div className="col-6">
          <label htmlFor="provision-type" className="form-label text-uppercase small fw-bold text-info mb-1">Entity Type</label>
          <select id="provision-type" name="type" defaultValue="Department" className="form-select bg-dark text-white border-secondary">
            <option value="Department">Department</option><option value="Organization">Organization</option>
          </select>
        </div>
      </div>
      <fieldset className="border border-info border-opacity-25 rounded-3 p-3">
        <legend className="float-none w-auto px-2 mb-2 fs-6 fw-semibold text-info">Initial Academic Calendar</legend>
        <p className="form-text mb-3">Required before the tenant receives any payments. Existing records may prevent changing the calendar later.</p>
        <div className="mb-3">
          <label htmlFor="provision-academic-year" className="form-label small fw-bold">First Academic Year</label>
          <input id="provision-academic-year" name="initialAcademicYear" required pattern="(?:A\.Y\.\s*)?[0-9]{4}\s*-\s*[0-9]{4}"
            defaultValue={`A.Y. ${new Date().getFullYear()} - ${new Date().getFullYear() + 1}`}
            title="Example: A.Y. 2026 - 2027" className="form-control bg-body text-body border-secondary" />
        </div>
        <div className="mb-3">
          <label htmlFor="provision-calendar-mode" className="form-label small fw-bold">Academic Period System</label>
          <select id="provision-calendar-mode" name="calendarMode" value={calendarMode}
            onChange={event => setCalendarMode(event.target.value as CalendarMode)}
            className="form-select bg-body text-body border-secondary">
            <option value="FullYear">Full School Year (one accounting period)</option>
            <option value="Semester">Semester (two periods)</option>
            <option value="Trimester">Trimester (three periods)</option>
          </select>
        </div>
        {calendarMode === 'Semester' && <label className="form-check mb-2">
          <input className="form-check-input" type="checkbox" checked={includeSummer} onChange={e => setIncludeSummer(e.target.checked)} />
          <span className="form-check-label">Include Summer term</span>
        </label>}
        <div className="small text-secondary">Available periods: <strong>{periodsFor({mode:calendarMode,includeSummer}).join(' · ')}</strong></div>
        <div className="small mt-2">First accounting period: <strong className="text-info">{periodsFor({mode:calendarMode,includeSummer})[0]}</strong></div>
      </fieldset>
      <hr className="border-secondary my-1" />
      <div>
        <label htmlFor="provision-admin-email" className="form-label text-uppercase small fw-bold text-info mb-1">Initial Entity Admin Email</label>
        <input id="provision-admin-email" type="email" name="adminEmail" required maxLength={254}
          placeholder="admin@example.com" className="form-control bg-dark text-white border-secondary" />
        <div className="form-text text-secondary small">Receives a one-time code for department and entity administrator login.</div>
      </div>
      <div>
        <label htmlFor="provision-admin-name" className="form-label text-uppercase small fw-bold text-info mb-1">Initial Admin Full Name</label>
        <input id="provision-admin-name" type="text" name="adminName" required maxLength={150}
          placeholder="Admin Name" className="form-control bg-dark text-white border-secondary" />
      </div>
      <p className="small text-secondary mb-0">After provisioning, the tenant administrator will complete <strong>fund allocation</strong> and <strong>Setup Collection Fees</strong>. Fee amounts and destination funds are not created automatically.</p>
      <button type="submit" disabled={loading} className="btn btn-info fw-bold w-100 py-2 mt-2 shadow-sm text-dark">
        {loading ? 'Provisioning Entity...' : 'Provision Entity & Admin'}
      </button>
    </form>
  );
}
