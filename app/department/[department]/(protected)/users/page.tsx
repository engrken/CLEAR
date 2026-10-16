// /app/department/[department]/(protected)/users/page.tsx

import { prisma } from '@/lib/prisma';
import UserManagementClient from './UserManagementClient';
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireDepartmentAccess, normalizeDepartmentSlug, parseAllowedTabs, isSuperAdminEmail } from '@/lib/permissions';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

interface PageProps {
  params: Promise<{ department: string }>;
}

export default async function UserManagementPage({ params }: PageProps) {
  const { department } = await params;
  const cleanSubdomain = normalizeDepartmentSlug(department);

  // =========================================================
  // AUTHORIZATION GUARD (F70 Fix)
  // Read-only: this page no longer creates organizations or seeds
  // accounts on GET (F62). Tenants and their first admin are created
  // only through Super Admin provisioning.
  // =========================================================
  let organization;
  try {
    ({ org: organization } = await requireDepartmentAccess('tab-users', cleanSubdomain));
  } catch {
    redirect(`/department/${encodeURIComponent(cleanSubdomain)}?forbidden=true`);
  }

  const dbUsers = await prisma.tenantUser.findMany({
    where: { organizationId: organization.id },
    orderBy: { fullName: 'asc' },
  });

  const users = dbUsers.map(u => ({
    id: u.id,
    userId: u.userId,
    name: u.fullName,
    email: u.email,
    username: u.username,
    role: u.role,
    status: u.status,
    allowedTabs: parseAllowedTabs(u.allowedTabs),
    isSuperAdmin: isSuperAdminEmail(u.email),
  }));

  return <UserManagementClient initialUsers={users} department={cleanSubdomain} />;
}
