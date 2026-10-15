// /app/department/[department]/(protected)/users/actions.ts

'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  admin: [
    'tab-overview', 'tab-students', 'tab-clearance', 'tab-reports',
    'tab-payment', 'tab-remittances', 'tab-penalties', 'tab-advances',
    'tab-audit', 'tab-collectibles', 'tab-void', 'tab-report', 'tab-transfer',
    'tab-users', 'tab-setup'
  ],
  treasurer: [
    'tab-overview', 'tab-clearance', 'tab-reports',
    'tab-payment', 'tab-remittances', 'tab-penalties', 'tab-advances',
    'tab-collectibles', 'tab-report', 'tab-transfer'
  ],
  auditor: [
    'tab-overview', 'tab-clearance', 'tab-reports', 'tab-audit', 'tab-report'
  ],
  viewer: [
    'tab-overview', 'tab-clearance', 'tab-reports', 'tab-report'
  ]
};

/**
 * Validates if the active session has the required tab permission.
 * Throws an error if unauthorized, halting the server action.
 */
export async function requireTabAccess(requiredTab: string) {
  const session = await auth();
  
  if (!session?.user) {
    throw new Error("401 Unauthorized: Session expired or invalid.");
  }

  const customUser = session.user as any;
  const allowedTabs = (customUser.allowedTabs as string[]) || [];

  // ❌ REMOVED THE HARDCODED ADMIN OVERRIDE HERE
  // The system will now STRICTLY respect the allowedTabs array for ALL roles.

  // Reject if the assigned scope lacks the necessary tab
  if (!allowedTabs.includes(requiredTab)) {
    throw new Error(`403 Forbidden: Your account scope lacks permission for the ${requiredTab} module.`);
  }

  return customUser;
}

export async function saveTenantUser(formData: {
  id?: string | null;
  userId?: string;
  fullName: string;
  email: string;
  username: string;
  role: string;
  status: string;
  allowedTabs: string[];
  department: string;
}) {
  // STRICT GUARD: User must have access to the User Management module
  await requireTabAccess('tab-users');

  const { id, userId, fullName, email, username, role, status, allowedTabs, department } = formData;

  if (!email || !username || !fullName) {
    throw new Error('Full Name, Username, and Email are required.');
  }

  const normalizedRole = ['master', 'administrator', 'admin'].includes(role.toLowerCase()) ? 'admin' : role.toLowerCase();
  const tabsToSave = allowedTabs && allowedTabs.length > 0 ? allowedTabs : (ROLE_PERMISSIONS_MAP[normalizedRole] || ROLE_PERMISSIONS_MAP.viewer);
  const tabsJsonString = JSON.stringify(tabsToSave);

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department.toLowerCase() },
  });

  if (!organization) {
    throw new Error(`Organization subdomain "${department}" not found.`);
  }

  const existingUsers = await prisma.tenantUser.findMany({
    where: { organizationId: organization.id },
  });

  for (const u of existingUsers) {
    if (id && u.id === id) continue;
    if (u.username.toLowerCase() === username.toLowerCase()) {
      throw new Error('Username is already taken by another account.');
    }
    if (u.email.toLowerCase() === email.toLowerCase()) {
      throw new Error('Email is already registered by another account.');
    }
  }

  if (id) {
    // Update existing user record
    await prisma.tenantUser.update({
      where: { id },
      data: {
        fullName,
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        role: normalizedRole,
        status,
        allowedTabs: tabsJsonString,
      },
    });
  } else {
    // Generate and explicitly supply userId to satisfy schema requirements
    const generatedUserId = userId || 'USR-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    await prisma.tenantUser.create({
      data: {
        organizationId: organization.id,
        userId: generatedUserId,
        fullName,
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        role: normalizedRole,
        status,
        allowedTabs: tabsJsonString,
      },
    });
  }

  revalidatePath(`/department/${department}/users`);
  return { success: true, message: 'User record saved successfully.' };
}

export async function deleteTenantUser(userId: string, department: string) {
  // STRICT GUARD: User must have access to the User Management module
  await requireTabAccess('tab-users');

  if (!userId) {
    throw new Error('User ID is required.');
  }

  const targetUser = await prisma.tenantUser.findUnique({
    where: { id: userId },
  });

  if (targetUser && targetUser.email === 'kent.bsece@gmail.com') {
    throw new Error('Action denied: Cannot delete the primary master administrator account.');
  }

  await prisma.tenantUser.delete({
    where: { id: userId },
  });

  revalidatePath(`/department/${department}/users`);
  return { success: true, message: 'User account successfully removed.' };
}