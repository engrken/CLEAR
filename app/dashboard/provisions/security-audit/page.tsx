import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/permissions';

export const dynamic = 'force-dynamic';
const PAGE_SIZE = 25;

const pht = (value: Date) => value.toLocaleString('en-PH', {
  timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'medium',
}) + ' PHT';

function parsedPage(value: unknown): number {
  if (typeof value !== 'string' || !/^[1-9]\d{0,5}$/.test(value)) return 1;
  return Math.min(Number(value), 100000);
}

export default async function GlobalAdministratorAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  try { await requireSuperAdmin(); }
  catch { redirect('/dashboard'); }

  const params = await searchParams;
  const requestedPage = parsedPage(params.page);
  const total = await prisma.globalAdminAudit.count();
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  const events = await prisma.globalAdminAudit.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: { id: true, createdAt: true, action: true, actorEmail: true, targetEmail: true },
  });
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  return <main className="container-fluid p-4 p-md-5" style={{ maxWidth: 1300, color: '#f8fafc' }}>
    <nav className="d-flex flex-wrap align-items-center gap-3 mb-3" aria-label="Security audit navigation">
      <Link href="/dashboard/provisions" className="text-info text-decoration-none">
        <i className="bi bi-arrow-left me-1" aria-hidden="true" />Back to Provisioning
      </Link>
      <Link href="/dashboard/provisions/administrators" className="btn btn-outline-info btn-sm ms-auto">
        <i className="bi bi-people me-2" aria-hidden="true" />Global Administrator Accounts
      </Link>
    </nav>
    <header className="p-4 rounded-4 border border-secondary mb-4" style={{ backgroundColor: '#1e293b' }}>
      <h1 className="h3 fw-bold text-white mb-2">Global Administrator Security Audit</h1>
      <p className="text-secondary mb-0">
        Restricted, read-only history of administrator invitations, account changes and security events.
        Records cannot be modified or deleted from this interface.
      </p>
    </header>
    <section className="card bg-dark border-secondary p-3 p-md-4" aria-label="Recent security log entries">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h2 className="h5 text-info mb-0">Security activity</h2>
        <span className="small text-secondary" aria-live="polite">
          Showing {first}–{last} of {total} events
        </span>
      </div>
      <div className="table-responsive">
        <table className="table table-dark table-hover table-sm align-middle">
          <thead><tr>
            <th scope="col">Time (PHT)</th>
            <th scope="col">Operation</th>
            <th scope="col">Actor</th>
            <th scope="col">Affected account</th>
          </tr></thead>
          <tbody>
            {events.map(event => <tr key={event.id}>
              <td className="text-nowrap">{pht(event.createdAt)}</td>
              <td>{event.action}</td>
              <td className="text-break">{event.actorEmail}</td>
              <td className="text-break">{event.targetEmail}</td>
            </tr>)}
            {events.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-secondary">
              No administrator security events have been recorded.
            </td></tr>}
          </tbody>
        </table>
      </div>
      <nav aria-label="Audit log pagination" className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
        <span className="text-secondary small">Page {page} of {pages}</span>
        <div className="d-flex gap-2">
          {page > 1 ? <Link href={`?page=${page - 1}`} className="btn btn-outline-info btn-sm">
            <i className="bi bi-chevron-left me-1" aria-hidden="true" />Previous
          </Link> : <span className="btn btn-outline-secondary btn-sm disabled" aria-disabled="true">Previous</span>}
          {page < pages ? <Link href={`?page=${page + 1}`} className="btn btn-outline-info btn-sm">
            Next<i className="bi bi-chevron-right ms-1" aria-hidden="true" />
          </Link> : <span className="btn btn-outline-secondary btn-sm disabled" aria-disabled="true">Next</span>}
        </div>
      </nav>
    </section>
  </main>;
}
