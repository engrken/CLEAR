// (protected)/logs/page.tsx

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import LogsClient from './LogsClient';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'System Audit Logs | CLEAR',
};

export default async function SystemLogsPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ page?: string }>;
}) {
  // =========================================================
  // 1. EXTRACT PARAMS & AUTHENTICATION
  // =========================================================
  const { department } = await params;
  const cleanDepartment = decodeURIComponent(department).trim().toLowerCase();

  const session = await auth();
  if (!session?.user) {
    redirect(`/department/${encodeURIComponent(cleanDepartment)}?login=true`);
  }

  // =========================================================
  // 2. AUTHORIZATION (SuperAdmin & Auditors Only)
  // =========================================================
  const userWithRole = session.user as typeof session.user & { role?: string | null; };
  const userRole = String(userWithRole.role ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '');
  const userEmail = String(userWithRole.email ?? '').trim().toLowerCase();

  const isSuperAdmin = userRole === 'superadmin' || userRole === 'master' || userEmail === 'kent.bsece@gmail.com';
  const allowedRoles = ['admin', 'administrator', 'auditor', 'audit'];

  if (!isSuperAdmin && !allowedRoles.includes(userRole)) {
    redirect(`/department/${encodeURIComponent(cleanDepartment)}?forbidden=true`);
  }

  // =========================================================
  // 3. PAGINATION & DB FETCH
  // =========================================================
  const resolvedSearch = searchParams ? await searchParams : {};
  const page = parseInt(resolvedSearch.page || '1', 10);
  const pageSize = 15;
  const skip = (page - 1) * pageSize;

  const organization = await prisma.organization.findUnique({
    where: { subdomain: cleanDepartment },
  });

  if (!organization) {
    return (
      <div className="alert alert-danger p-4 shadow-sm border-secondary">
        <h4 className="fw-bold mb-2">Department Not Found</h4>
        <p className="small mb-0">The department '{decodeURIComponent(department)}' does not exist.</p>
      </div>
    );
  }

  const totalCount = await prisma.systemLog.count({
    where: { organizationId: organization.id }
  });

  const logs = await prisma.systemLog.findMany({
    where: { organizationId: organization.id },
    orderBy: { timestamp: 'desc' },
    skip,
    take: pageSize,
  });

  const totalPages = Math.ceil(totalCount / pageSize) || 1;

  // Format data safely for Client Component
  const serializedLogs = logs.map(l => ({
    id: l.id,
    timestamp: new Date(l.timestamp).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium'
    }),
    user: l.user,
    action: l.action,
    details: l.details || "No additional details recorded.",
  }));

  // =========================================================
  // 4. RENDER
  // =========================================================
  return (
    <div className="module card p-0 border-secondary shadow-sm overflow-hidden bg-body text-body">
      <LogsClient 
        initialLogs={serializedLogs} 
        department={organization.name} 
        currentPage={page} 
        totalPages={totalPages} 
      />
    </div>
  );
}