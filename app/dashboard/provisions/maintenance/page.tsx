import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/permissions';
import { MaintenancePolicyForm, MaintenanceNoticeCreateForm, MaintenanceNoticeEditForms } from './MaintenanceForms';

export const dynamic = 'force-dynamic';
const pht = (d: Date) => d.toLocaleString('en-PH', {
  timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
}) + ' PHT';
const inputTime = (d: Date) => new Date(d.getTime() + 8 * 3600000).toISOString().slice(0,16);

export default async function MaintenanceAdminPage() {
  let admin;
  try { admin = await requireSuperAdmin(); }
  catch {
    // Full-maintenance recovery must remain reachable BEFORE authentication,
    // but the actual console and all mutations still require a verified Global
    // Administrator session. Never redirect into the blocked public dashboard.
    return <main className="container py-5 text-white" style={{ maxWidth: 660 }}>
      <div className="card bg-dark border-info p-4">
        <h1 className="h3">Global Administrator maintenance recovery</h1>
        <p>Authenticate with the authorized Global Administrator email and OTP to access maintenance controls.</p>
        {process.env.VERCEL_ENV === 'preview' ? <p className="small text-warning">
          Staging verification only. Request a NEW code from this staging page and
          use the email titled &quot;CLEAR STAGING ONLY&quot; within five minutes.
          Production verification codes do not work here. A generic confirmation
          does not guarantee delivery; check your inbox and spam folder.
        </p> : null}
        <button type="button" className="btn btn-info" data-bs-toggle="modal"
          data-bs-target="#otpAuthModal">Authenticate with email OTP</button>
      </div>
    </main>;
  }
  const [policies, notices, audits, orgs] = await Promise.all([
    prisma.maintenancePolicy.findMany({ orderBy: { scopeKey: 'asc' } }),
    prisma.maintenanceNotice.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.maintenanceAudit.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
    prisma.organization.findMany({ select: { subdomain: true, name: true }, orderBy: { name: 'asc' } }),
  ]);
  const options = [{ key: 'global', name: 'GLOBAL — all tenants' },
    ...orgs.map(o => ({ key: o.subdomain, name: o.name + ' (' + o.subdomain + ')' }))];
  const globalPolicy = policies.find(p => p.scopeKey === 'GLOBAL');
  const globalMode = globalPolicy && globalPolicy.mode !== 'NORMAL' &&
    (!globalPolicy.expiresAt || globalPolicy.expiresAt > new Date())
    ? globalPolicy.mode : 'NORMAL';
  const defaultEnd = inputTime(new Date(Date.now() + 2 * 3600000));
  return <main className="container py-4 text-white" style={{ maxWidth: 1200 }}>
    <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-4">
      <div><Link href="/dashboard/provisions" className="text-info">Back to Global Administrator</Link>
        <h1 className="h2 mt-3">Maintenance Control &amp; Notice Board</h1>
        <p className="text-secondary">Server-enforced protection · Times entered and displayed in Asia/Manila (PHT)</p></div>
      <span className={`badge fs-6 ${globalMode === 'NORMAL' ? 'bg-success' : 'bg-warning text-dark'}`}>
        Global: {globalMode} · {globalMode === 'NORMAL' ? 'OFF' : 'ON'}
      </span>
    </div>
    <div className="alert alert-warning">
      <strong>Global Administrator only.</strong> Mode changes are active immediately on the web API.
      Publishing a notice does NOT activate maintenance. Expiry automatically restores NORMAL.
      During FULL mode use this control URL to restore service.
    </div>
    <div className="row g-3">
      <section className="col-lg-6">
        <div className="card bg-dark border-info p-4 h-100">
          <h2 className="h5">Set effective maintenance policy</h2>
          <MaintenancePolicyForm options={options} expiresDefault={defaultEnd} />
          <h3 className="h6 mt-4">Current policies</h3>
          {policies.length === 0 ? <p className="small text-success">No policy rows. All scopes are NORMAL (OFF).</p> :
            <ul className="list-group">{policies.map(p => <li key={p.scopeKey}
              className="list-group-item bg-dark text-white border-secondary">
              <strong>{p.scopeKey}</strong> · {p.expiresAt && p.expiresAt < new Date() ? 'EXPIRED / NORMAL' : p.mode}
              <div className="small text-secondary">{p.reason || 'No maintenance reason'} · {pht(p.updatedAt)}</div>
            </li>)}</ul>}
        </div>
      </section>
      <section className="col-lg-6">
        <div className="card bg-dark border-info p-4 h-100">
          <h2 className="h5">Create Notice Board announcement</h2>
          <MaintenanceNoticeCreateForm options={options} startsDefault={inputTime(new Date(Date.now() + 3600000))} endsDefault={defaultEnd} />
        </div>
      </section>
    </div>
    <section className="card bg-dark border-secondary p-4 mt-4">
      <h2 className="h5">Announcements</h2>
      <p className="text-secondary small">Published notices appear automatically during the chosen dates.
        Cancellation hides the notice; it never changes maintenance restrictions.</p>
      {notices.length === 0 ? <p>No announcements recorded.</p> : notices.map(n =>
        <div key={n.id} className="border-bottom border-secondary py-3">
          <strong>{n.title}</strong> <span className="badge bg-secondary">{n.state}</span>
          <span className="text-info ms-2">{n.scopeKey}</span>
          <p className="small mb-1">{n.message}</p>
          <p className="small text-secondary">{pht(n.startsAt)} – {pht(n.endsAt)} · revision {n.version}</p>
          {n.state !== 'CANCELLED' ?
            <MaintenanceNoticeEditForms key={n.id + ':' + n.version} id={n.id}
              draft={n.state === 'DRAFT'} startsDefault={inputTime(n.startsAt)}
              endsDefault={inputTime(n.endsAt)} />
            : null}
        </div>)}
    </section>
    <section className="card bg-dark border-secondary p-4 mt-4">
      <h2 className="h5">Recent immutable maintenance audit</h2>
      <table className="table table-sm table-dark"><thead><tr>
        <th>Time (PHT)</th><th>Scope</th><th>Operation</th><th>Actor</th></tr></thead>
        <tbody>{audits.map(a => <tr key={a.id}>
          <td>{pht(a.createdAt)}</td><td>{a.scopeKey}</td><td>{a.action}</td><td>{a.actor}</td>
        </tr>)}</tbody>
      </table>
      <p className="small text-secondary">Signed in as {admin.email}. There are no controls to delete audit entries.</p>
    </section>
  </main>;
}
