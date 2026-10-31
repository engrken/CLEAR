import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/permissions';
import { maintenanceForTenant } from '@/lib/maintenance/service';
import { MaintenanceNoticeCreateForm, MaintenanceNoticeEditForms, LegacyMaintenanceRestoreForm } from './MaintenanceForms';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 20;
const pht = (d: Date) => d.toLocaleString('en-PH', {
  timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
}) + ' PHT';
const inputTime = (d: Date) => new Date(d.getTime() + 8 * 3600000).toISOString().slice(0, 16);

export default async function MaintenanceAdminPage({
  searchParams,
}: { searchParams: Promise<{ logsPage?: string | string[] }> }) {
  let admin;
  try { admin = await requireSuperAdmin(); }
  catch {
    // Authentication and recovery must stay available in FULL mode.
    // The console and all Server Actions still require the real admin role and OTP.
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

  const rawPage = (await searchParams)?.logsPage;
  const pageText = typeof rawPage === 'string' ? rawPage : '1';
  const requestedPage = /^\d{1,6}$/.test(pageText) ? Math.max(1, Number(pageText)) : 1;
  const now = new Date();
  const [policies, notices, auditCount, orgs, globalStatus] = await Promise.all([
    prisma.maintenancePolicy.findMany({ orderBy: { scopeKey: 'asc' } }),
    prisma.maintenanceNotice.findMany({
      where: { state: { in: ['SCHEDULED', 'DRAFT'] }, endsAt: { gt: now } },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'desc' }], take: 100,
    }),
    prisma.maintenanceAudit.count(),
    prisma.organization.findMany({ select: { subdomain: true, name: true }, orderBy: { name: 'asc' } }),
    maintenanceForTenant(null),
  ]);
  const totalPages = Math.max(1, Math.ceil(auditCount / PAGE_SIZE));
  const logsPage = Math.min(requestedPage, totalPages);
  const audits = await prisma.maintenanceAudit.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (logsPage - 1) * PAGE_SIZE, take: PAGE_SIZE,
  });
  const options = [{ key: 'global', name: 'Global — all tenants' },
    ...orgs.map(o => ({ key: o.subdomain, name: o.name + ' (' + o.subdomain + ')' }))];
  const defaultStart = inputTime(new Date(Date.now() + 3600000));
  const defaultEnd = inputTime(new Date(Date.now() + 2 * 3600000));
  const legacyActive = policies.filter(p => p.mode !== 'NORMAL' &&
    (!p.expiresAt || p.expiresAt > now));

  return <main className="container py-4 text-white" style={{ maxWidth: 1100 }}>
    <div className="d-flex justify-content-between align-items-center gap-3 flex-wrap mb-4">
      <div>
        <Link href="/dashboard/provisions" className="text-info">Back to Global Administrator</Link>
        <h1 className="h2 mt-3">Maintenance &amp; Announcements</h1>
        <p className="text-secondary mb-0">One control center · All times in Philippine Standard Time (UTC+08:00)</p>
      </div>
      <span className={`badge fs-6 ${globalStatus.mode === 'NORMAL' ? 'bg-success' : 'bg-warning text-dark'}`}>
        Global: {globalStatus.mode === 'NORMAL' ? 'Normal service' : globalStatus.mode + ' active'}
      </span>
    </div>
    <div className="alert alert-info">
      <strong>Global Administrator only.</strong> Choose Global or one tenant, write the announcement,
      and set its start and end. A maintenance mode starts and ends automatically using server time,
      including for mobile users. The announcement-only option never blocks transactions.
      An active window can be ended early below, with an immutable audit entry.
    </div>
    <section className="card bg-dark border-info p-4">
      <h2 className="h5 mb-1">Maintenance &amp; Notice Board settings</h2>
      <p className="text-secondary small">One schedule controls the notice and the service restriction.
        Existing schedules are listed below. FULL mode keeps this recovery console accessible.</p>
      <MaintenanceNoticeCreateForm options={options}
        startsDefault={defaultStart} endsDefault={defaultEnd} />
    </section>

    <section className="card bg-dark border-secondary p-4 mt-4">
      <h2 className="h5">Scheduled and active windows</h2>
      <p className="text-secondary small">The most restrictive overlapping window wins within one scope;
        an active Global maintenance window takes priority over a tenant window.
        Dates also restore NORMAL automatically when no other active restriction remains.</p>
      {notices.length === 0 ? <p className="small text-success">No upcoming or active maintenance announcements.</p> : notices.map(n => {
        const active = n.state === 'SCHEDULED' && n.startsAt <= now && n.endsAt > now;
        const state = n.state === 'DRAFT' ? 'Draft' : active ? 'Active' : 'Upcoming';
        return <div key={n.id} className="border-bottom border-secondary py-3">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <strong>{n.title}</strong>
            <span className={`badge ${active && n.mode !== 'NORMAL' ? 'bg-warning text-dark' : 'bg-secondary'}`}>
              {state}
            </span>
            <span className="badge bg-dark border border-info">{n.mode === 'NORMAL' ? 'Notice only' : n.mode}</span>
            <span className="small text-info">{n.scopeKey}</span>
          </div>
          <p className="small mb-1">{n.message}</p>
          <p className="small text-secondary">{pht(n.startsAt)} – {pht(n.endsAt)} · revision {n.version}</p>
          <MaintenanceNoticeEditForms key={n.id + ':' + n.version}
            id={n.id} draft={n.state === 'DRAFT'} active={active}
            mode={n.mode} startsDefault={inputTime(n.startsAt)}
            endsDefault={inputTime(n.endsAt)} />
        </div>;
      })}
    </section>

    {legacyActive.length ? <details className="card bg-dark border-warning p-4 mt-4">
      <summary className="fw-semibold text-warning">Existing manual maintenance overrides ({legacyActive.length})</summary>
      <p className="small text-secondary mt-2">Legacy manually applied policies are separate emergency overrides.
        They are not replaced by a scheduled notice. Restore them explicitly if they are still in effect.</p>
      {legacyActive.map(p => <div key={p.scopeKey} className="border-bottom border-secondary py-2">
        <strong>{p.scopeKey}</strong> · {p.mode} · {p.reason}
        <p className="small text-secondary">{p.expiresAt ? 'Expires ' + pht(p.expiresAt) : 'No expiry'}</p>
        <LegacyMaintenanceRestoreForm scopeKey={p.scopeKey} />
      </div>)}
    </details> : null}

    <details id="maintenance-logs" className="card bg-dark border-secondary p-4 mt-4"
      open={logsPage > 1}>
      <summary className="h5" style={{ cursor: 'pointer' }}>
        <span className="btn btn-outline-info btn-sm me-2">Logs</span>
        Maintenance history ({auditCount})
      </summary>
      <p className="small text-secondary mt-3">Paginated append-only history of creation,
        rescheduling, cancellation and early restoration. Scheduled start and expiry are enforced
        from the stored window; they do not require a separate timed database write.</p>
      <div className="table-responsive">
        <table className="table table-sm table-dark">
          <thead><tr><th>Time (PHT)</th><th>Scope</th><th>Operation</th><th>Actor</th></tr></thead>
          <tbody>{audits.map(a => <tr key={a.id}>
            <td>{pht(a.createdAt)}</td><td>{a.scopeKey}</td><td>{a.action}</td><td>{a.actor}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {auditCount === 0 ? <p className="small">No audit entries yet.</p> : null}
      <nav aria-label="Maintenance audit log pages" className="d-flex gap-3 align-items-center flex-wrap">
        {logsPage > 1 ? <Link className="btn btn-outline-info btn-sm"
          href={`?logsPage=${logsPage - 1}#maintenance-logs`}>Previous</Link> : null}
        <span className="small text-secondary">Page {logsPage} of {totalPages} · {PAGE_SIZE} per page</span>
        {logsPage < totalPages ? <Link className="btn btn-outline-info btn-sm"
          href={`?logsPage=${logsPage + 1}#maintenance-logs`}>Next</Link> : null}
      </nav>
      <p className="small text-secondary mt-3 mb-0">Signed in as {admin.email}. Log deletion is not available.</p>
    </details>
  </main>;
}
