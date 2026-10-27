import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/permissions';
import { createMaintenanceNotice, editMaintenanceNotice, setMaintenancePolicy } from './actions';

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
  const defaultEnd = inputTime(new Date(Date.now() + 2 * 3600000));
  return <main className="container py-4 text-white" style={{ maxWidth: 1200 }}>
    <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-4">
      <div><Link href="/dashboard/provisions" className="text-info">Back to Global Administrator</Link>
        <h1 className="h2 mt-3">Maintenance Control &amp; Notice Board</h1>
        <p className="text-secondary">Server-enforced protection · Times entered and displayed in Asia/Manila (PHT)</p></div>
      <span className="badge bg-success fs-6">Default: NORMAL · OFF</span>
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
          <form action={setMaintenancePolicy} className="d-grid gap-3 mt-3">
            <label>Scope<select name="scope" className="form-select" required>{options.map(o =>
              <option key={o.key} value={o.key}>{o.name}</option>)}</select></label>
            <label>Mode<select name="mode" className="form-select" defaultValue="NORMAL">
              <option value="NORMAL">NORMAL — maintenance OFF</option>
              <option value="READ_ONLY">READ_ONLY — disable mutations</option>
              <option value="FULL">FULL — maintenance landing only</option>
            </select></label>
            <label>Public reason<textarea name="reason" className="form-control" maxLength={240}
              placeholder="Explain the outage without including private student or staff details."/></label>
            <label>Expires (PHT, required for active modes)<input name="expiresAt"
              type="datetime-local" className="form-control" defaultValue={defaultEnd}/></label>
            <label>Confirmation<input name="confirmation" className="form-control"
              placeholder="APPLY MAINTENANCE or RESTORE NORMAL" required autoComplete="off"/></label>
            <button type="submit" className="btn btn-outline-warning">Confirm policy update</button>
          </form>
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
          <form action={createMaintenanceNotice} className="d-grid gap-3 mt-3">
            <label>Audience / scope<select name="scope" className="form-select" required>{options.map(o =>
              <option key={o.key} value={o.key}>{o.name}</option>)}</select></label>
            <label>Title<input name="title" className="form-control" maxLength={140}
              placeholder="Scheduled CLEAR service maintenance" required/></label>
            <label>Description<textarea name="message" className="form-control" maxLength={800} required
              placeholder="Brief details, impacted services and expected service restoration."/></label>
            <label>Starts (PHT)<input name="startsAt" type="datetime-local"
              className="form-control" defaultValue={inputTime(new Date(Date.now() + 3600000))} required/></label>
            <label>Ends (PHT)<input name="endsAt" type="datetime-local"
              className="form-control" defaultValue={defaultEnd} required/></label>
            <label>Publication<select name="state" className="form-select">
              <option value="DRAFT">DRAFT — invisible to public</option>
              <option value="SCHEDULED">SCHEDULED — publish notice only</option>
            </select></label>
            <button type="submit" className="btn btn-outline-info">Create announcement</button>
          </form>
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
          {n.state !== 'CANCELLED' ? <div className="d-flex flex-wrap gap-2">
            {n.state === 'DRAFT' ? <form action={editMaintenanceNotice} className="d-flex gap-2 align-items-center">
              <input type="hidden" name="id" value={n.id}/><input type="hidden" name="command" value="PUBLISH"/>
              <input name="confirmation" className="form-control form-control-sm" placeholder="PUBLISH" required/>
              <button className="btn btn-outline-info btn-sm">Publish</button>
            </form> : null}
            <form action={editMaintenanceNotice} className="d-flex gap-2 flex-wrap align-items-center">
              <input type="hidden" name="id" value={n.id}/><input type="hidden" name="command" value="RESCHEDULE"/>
              <input type="datetime-local" name="startsAt" defaultValue={inputTime(n.startsAt)}
                className="form-control form-control-sm" aria-label="New start time PHT" required/>
              <input type="datetime-local" name="endsAt" defaultValue={inputTime(n.endsAt)}
                className="form-control form-control-sm" aria-label="New end time PHT" required/>
              <input name="confirmation" className="form-control form-control-sm" placeholder="RESCHEDULE" required/>
              <button className="btn btn-outline-warning btn-sm">Reschedule</button>
            </form>
            <form action={editMaintenanceNotice} className="d-flex gap-2 align-items-center">
              <input type="hidden" name="id" value={n.id}/><input type="hidden" name="command" value="CANCEL"/>
              <input name="confirmation" className="form-control form-control-sm" placeholder="CANCEL" required/>
              <button className="btn btn-outline-danger btn-sm">Cancel</button>
            </form>
          </div> : null}
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
