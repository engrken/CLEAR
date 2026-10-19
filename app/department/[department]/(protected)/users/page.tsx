// /app/department/[department]/(protected)/users/page.tsx

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import UserManagementClient from './UserManagementClient';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import {
  isSuperAdminEmail,
  requireOrgAdmin,
} from '@/lib/permissions';
import { parseAllowedTabs } from '@/lib/role-permissions';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

interface PageProps {
  params: Promise<{ department: string }>;
}

export default async function UserManagementPage({
  params,
}: PageProps) {
  const resolvedParams = await params;

  let cleanSubdomain = String(
    resolvedParams?.department ?? ''
  ).trim();

  try {
    cleanSubdomain = decodeURIComponent(cleanSubdomain)
      .trim()
      .toLowerCase();
  } catch {
    redirect('/dashboard');
  }

  // Never silently default to another tenant.
  if (
    !cleanSubdomain ||
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(
      cleanSubdomain
    )
  ) {
    redirect('/dashboard');
  }

  // Verify authentication, tenant membership, organization status,
  // and permission to access User Management.
  let access: Awaited<ReturnType<typeof requireOrgAdmin>>;

  try {
    access = await requireOrgAdmin(cleanSubdomain);
  } catch {
    redirect(
      `/department/${encodeURIComponent(
        cleanSubdomain
      )}?forbidden=true`
    );
  }

  /*
   * IMPORTANT:
   * This page is READ-ONLY with respect to provisioning.
   *
   * It must never:
   * - create an Organization;
   * - create a Super Admin tenant-user duplicate;
   * - create default administrator, treasurer, or auditor accounts;
   * - create accounts because the tenant has zero or one user.
   *
   * Tenant creation and initial owner creation belong in the
   * authorized tenant-provisioning action.
   */

  const dbUsers = await prisma.tenantUser.findMany({
    where: {
      organizationId: access.organizationId,
    },
    orderBy: {
      fullName: 'asc',
    },
  });

  // Pass only the fields required by the Client Component.
  // The global Super Admin flag is calculated on the server.
  const reservedGlobalAdmins = await prisma.globalSuperAdmin.findMany({
    where: { email: { in: dbUsers.map(u => u.email.trim().toLowerCase()) } },
    select: { email: true },
  });
  const reservedGlobalEmails = new Set(reservedGlobalAdmins.map(x => x.email));

  const users = dbUsers.map((user) => ({
    id: user.id,
    userId: user.userId,
    name: user.fullName,
    email: user.email,
    username: user.username,
    role: user.role,
    status: user.status,
    otpAttempts: user.otpAttempts,
    allowedTabs: parseAllowedTabs(user.allowedTabs),
    isSuperAdmin: isSuperAdminEmail(user.email) || reservedGlobalEmails.has(user.email.trim().toLowerCase()),
  }));

  const session = await auth();
  return (
    <UserManagementClient
      initialUsers={users}
      department={cleanSubdomain}
      currentUserId={String(session?.user?.id ?? '')}
      currentUserEmail={String(session?.user?.email ?? '')}
    />
  );
}