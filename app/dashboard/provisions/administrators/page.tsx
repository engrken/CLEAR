import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/permissions';
import { GlobalAdminManager } from '../GlobalAdminManager';

export const dynamic = 'force-dynamic';

export default async function GlobalAdministratorsPage() {
  let actorEmail: string;
  try {
    const admin = await requireSuperAdmin();
    actorEmail = String(admin.email || '').trim().toLowerCase();
  } catch {
    redirect('/dashboard');
  }
  const accounts = await prisma.globalSuperAdmin.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { id: true, email: true, fullName: true, status: true, invitedBy: true,
      invitationExpiresAt: true, lastLoginAt: true, activatedAt: true, createdAt: true },
  });

  return <main className="container-fluid p-4 p-md-5" style={{ maxWidth: 1300, color: '#f8fafc' }}>
    <nav className="d-flex flex-wrap align-items-center gap-3 mb-3" aria-label="Global administration">
      <Link href="/dashboard/provisions" className="text-info text-decoration-none">
        <i className="bi bi-arrow-left me-1" aria-hidden="true" />Back to Provisioning
      </Link>
      <Link href="/dashboard/provisions/security-audit" className="btn btn-outline-info btn-sm ms-auto">
        <i className="bi bi-shield-check me-2" aria-hidden="true" />View Security Audit
      </Link>
    </nav>
    <header className="p-4 rounded-4 border border-secondary mb-4" style={{ backgroundColor: '#1e293b' }}>
      <h1 className="h3 fw-bold text-white mb-2">Global Administrator Accounts</h1>
      <p className="text-secondary mb-0">
        Invite and manage platform administrators independently from tenant provisioning.
        All account changes are authenticated and recorded in the security audit.
      </p>
    </header>
    <GlobalAdminManager accounts={accounts} actorEmail={actorEmail} />
  </main>;
}
