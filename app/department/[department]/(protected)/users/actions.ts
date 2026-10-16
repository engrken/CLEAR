// /app/department/[department]/(protected)/users/actions.ts

'use server';

import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireDepartmentAccess, isSuperAdminEmail, PRESET_ROLE_TABS } from '@/lib/permissions';
import { logSystemAction } from '@/lib/logger';

const VALID_ROLES = new Set(Object.keys(PRESET_ROLE_TABS));
const VALID_TABS = new Set(PRESET_ROLE_TABS.admin);
const VALID_STATUSES = new Set(['Active', 'Inactive']);

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
  // Membership in THIS department plus the User Management tab (or Super Admin)
  const { user: actor, org } = await requireDepartmentAccess('tab-users', formData.department);

  const id = formData.id ? String(formData.id) : null;
  const fullName = String(formData.fullName || '').trim();
  const email = String(formData.email || '').trim().toLowerCase();
  const username = String(formData.username || '').trim().toLowerCase();
  const status = VALID_STATUSES.has(formData.status) ? formData.status : 'Active';

  if (!email || !username || !fullName) {
    throw new Error('Full Name, Username, and Email are required.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please provide a valid email address.');
  }

  const rawRole = String(formData.role || '').trim().toLowerCase();
  const normalizedRole = ['master', 'administrator', 'admin'].includes(rawRole) ? 'admin' : rawRole;
  if (!VALID_ROLES.has(normalizedRole)) {
    throw new Error(`Unknown role "${formData.role}".`);
  }

  const requestedTabs = Array.isArray(formData.allowedTabs)
    ? formData.allowedTabs.filter((t) => VALID_TABS.has(t))
    : [];
  const tabsToSave = requestedTabs.length > 0 ? requestedTabs : PRESET_ROLE_TABS[normalizedRole];
  const tabsJsonString = JSON.stringify(tabsToSave);

  const existingUsers = await prisma.tenantUser.findMany({
    where: { organizationId: org.id },
  });

  if (id && !existingUsers.some((u) => u.id === id)) {
    throw new Error('User not found in this department.');
  }

  for (const u of existingUsers) {
    if (id && u.id === id) continue;
    if (u.username.toLowerCase() === username) {
      throw new Error('Username is already taken by another account.');
    }
    if (u.email.toLowerCase() === email) {
      throw new Error('Email is already registered by another account.');
    }
  }

  if (id) {
    await prisma.tenantUser.updateMany({
      where: { id, organizationId: org.id },
      data: {
        fullName,
        email,
        username,
        role: normalizedRole,
        status,
        allowedTabs: tabsJsonString,
      },
    });
  } else {
    const generatedUserId =
      String(formData.userId || '').trim() ||
      'USR-' + crypto.randomBytes(4).toString('hex').toUpperCase();

    await prisma.tenantUser.create({
      data: {
        organizationId: org.id,
        userId: generatedUserId,
        fullName,
        email,
        username,
        role: normalizedRole,
        status,
        allowedTabs: tabsJsonString,
      },
    });
  }

  await logSystemAction(
    org.id,
    actor.fullName || actor.email,
    id ? 'UPDATE_TENANT_USER' : 'CREATE_TENANT_USER',
    `${id ? 'Updated' : 'Created'} officer account ${username} (${email}) with role ${normalizedRole}.`
  );

  revalidatePath(`/department/${org.subdomain}/users`);
  return { success: true, message: 'User record saved successfully.' };
}

export async function deleteTenantUser(userId: string, department: string) {
  const { user: actor, org } = await requireDepartmentAccess('tab-users', department);

  if (!userId) {
    throw new Error('User ID is required.');
  }

  const targetUser = await prisma.tenantUser.findFirst({
    where: { id: String(userId), organizationId: org.id },
  });
  if (!targetUser) {
    throw new Error('User not found in this department.');
  }

  if (isSuperAdminEmail(targetUser.email)) {
    throw new Error('Action denied: Cannot delete the primary master administrator account.');
  }
  if (targetUser.email.toLowerCase() === String(actor.email || '').toLowerCase()) {
    throw new Error('Action denied: You cannot delete your own account.');
  }

  await prisma.tenantUser.deleteMany({
    where: { id: targetUser.id, organizationId: org.id },
  });

  await logSystemAction(
    org.id,
    actor.fullName || actor.email,
    'DELETE_TENANT_USER',
    `Removed officer account ${targetUser.username} (${targetUser.email}).`
  );

  revalidatePath(`/department/${org.subdomain}/users`);
  return { success: true, message: 'User account successfully removed.' };
}
