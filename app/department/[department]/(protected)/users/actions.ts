// /app/department/[department]/(protected)/users/actions.ts

'use server';

import { randomBytes } from 'node:crypto';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import {
  requireOrgAdmin,
  requireTabAccess as sharedRequireTabAccess,
  isSuperAdminEmail,
  PRESET_ROLE_TABS,
} from '@/lib/permissions';

// =========================================================================
// GENERAL HELPERS
// =========================================================================

function normalizeDepartment(value: unknown): string {
  let raw = String(value ?? '');

  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Keep the original value if it is not valid encoded text.
  }

  const department = raw.trim().toLowerCase();

  if (!department) {
    throw new Error('Department is required.');
  }

  return department;
}

/** Identify the authenticated account by its immutable database ID first.
 * Email matching is a defensive fallback for legacy sessions. The target is
 * already restricted to the caller's organization by the query above.
 */
async function isActingOnOwnAccount(target: { id: string; email: string }): Promise<boolean> {
  const session = await auth();
  const sessionId = String(session?.user?.id ?? "").trim();
  const sessionEmail = String(session?.user?.email ?? "").trim().toLowerCase();
  return Boolean(
    (sessionId && sessionId === target.id) ||
    (sessionEmail && sessionEmail === target.email.trim().toLowerCase())
  );
}

function isProtectedMasterAccount(email: unknown): boolean {
  const normalizedEmail = String(email ?? '').trim().toLowerCase();

  return isSuperAdminEmail(normalizedEmail);
}

function resolveRole(role: unknown): string {
  const rawRole = String(role ?? '').trim().toLowerCase();

  // Preserve the existing role aliases.
  if (['master', 'administrator', 'admin'].includes(rawRole)) {
    return 'admin';
  }

  return rawRole;
}

function normalizeUserStatus(status: unknown): 'Active' | 'Inactive' | 'Blocked' {
  const value = String(status ?? '').trim().toLowerCase();

  if (value === 'active') return 'Active';
  if (value === 'inactive') return 'Inactive';
  if (value === 'blocked') return 'Blocked';

  throw new Error('Invalid account status.');
}

function validateAllowedTabs(value: unknown, role: string): string[] {
  if (value !== undefined && !Array.isArray(value)) {
    throw new Error('Invalid tab permissions.');
  }

  const requestedTabs = Array.isArray(value)
    ? Array.from(
        new Set(
          value
            .filter((tab): tab is string => typeof tab === 'string')
            .map((tab) => tab.trim())
            .filter(Boolean)
        )
      )
    : [];

  // Only accept tab identifiers known to the shared permission system.
  const knownTabs = new Set<string>(
    Object.values(PRESET_ROLE_TABS).flat()
  );

  const unknownTab = requestedTabs.find((tab) => !knownTabs.has(tab));

  if (unknownTab) {
    throw new Error(`Invalid tab permission: ${unknownTab}`);
  }

  // Preserve the existing behavior: an empty selection uses role defaults.
  return requestedTabs.length > 0
    ? requestedTabs
    : [...(PRESET_ROLE_TABS[role] || PRESET_ROLE_TABS.viewer)];
}

// =========================================================================
// SHARED TAB GUARD
// =========================================================================

/**
 * Compatibility wrapper for any existing imports of this function.
 *
 * Unlike the previous local guard, this delegates to lib/permissions.ts,
 * which verifies organization membership and database-backed permissions.
 */
export async function requireTabAccess(
  requiredTab: string,
  department: string
) {
  return sharedRequireTabAccess(
    requiredTab,
    normalizeDepartment(department)
  );
}

// A department must always retain at least one ACTIVE administrator. Keep this
// check inside a transaction before destructive status/role changes in production.
const isAdmin = (role: unknown) => ['admin', 'administrator', 'master'].includes(String(role || '').trim().toLowerCase());
async function preventLastAdminRemoval(organizationId: string, targetId: string, oldRole: string, oldStatus: string, nextRole: string, nextStatus: string) {
  if (!(isAdmin(oldRole) && oldStatus === 'Active') || (isAdmin(nextRole) && nextStatus === 'Active')) return;
  const otherActiveAdmins = await prisma.tenantUser.count({
    where: { organizationId, status: 'Active', role: { in: ['admin', 'Admin', 'administrator', 'master'] }, NOT: { id: targetId } },
  });
  if (otherActiveAdmins === 0) throw new Error('At least one active organization administrator must remain.');
}

// =========================================================================
// SAVE / CREATE TENANT USER
// =========================================================================

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
  const department = normalizeDepartment(formData?.department);

  // User management is restricted to organization administrators
  // and the Super Admin.
  const access = await requireOrgAdmin(department);
  const organizationId = access.organizationId;

  const targetId = String(formData.id ?? '').trim();

  const fullName = String(formData.fullName ?? '').trim();
  const email = String(formData.email ?? '').trim().toLowerCase();
  const username = String(formData.username ?? '').trim().toLowerCase();
  const role = resolveRole(formData.role);
  const status = normalizeUserStatus(formData.status);

  if (!fullName || !email || !username) {
    throw new Error('Full Name, Username, and Email are required.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please provide a valid email address.');
  }

  if (!Object.prototype.hasOwnProperty.call(PRESET_ROLE_TABS, role)) {
    throw new Error('Invalid user role.');
  }

  // Do not create a tenant account using a protected Super Admin email.
  if (isProtectedMasterAccount(email)) {
    throw new Error(
      'This email is reserved for the primary Super Admin account.'
    );
  }

  const tabsToSave = validateAllowedTabs(formData.allowedTabs, role);
  const tabsJsonString = JSON.stringify(tabsToSave);

  // If updating, the target account MUST belong to this organization.
  const targetUser = targetId
    ? await prisma.tenantUser.findFirst({
        where: {
          id: targetId,
          organizationId,
        },
      })
    : null;

  if (targetId && !targetUser) {
    throw new Error(
      'User not found in this department or you are not authorized to modify it.'
    );
  }

  if (targetUser && isProtectedMasterAccount(targetUser.email)) {
    throw new Error(
      'Action denied: Cannot modify the primary Super Admin account.'
    );
  }

  if (targetUser) {
    await preventLastAdminRemoval(organizationId, targetUser.id, targetUser.role, targetUser.status, role, status);
    // Administrators may edit their own profile but cannot deactivate,
    // block, or demote their currently authenticated account.
    if (await isActingOnOwnAccount(targetUser) &&
        (status !== 'Active' || !isAdmin(role))) {
      throw new Error('You cannot deactivate, block, or remove administrator access from your own signed-in account.');
    }
  }

  // Check username and email uniqueness within this organization only.
  const existingUsers = await prisma.tenantUser.findMany({
    where: { organizationId },
    select: {
      id: true,
      username: true,
      email: true,
    },
  });

  for (const existing of existingUsers) {
    if (targetId && existing.id === targetId) {
      continue;
    }

    if (
      String(existing.username).trim().toLowerCase() === username
    ) {
      throw new Error(
        'Username is already taken by another account in this department.'
      );
    }

    if (
      String(existing.email).trim().toLowerCase() === email
    ) {
      throw new Error(
        'Email is already registered by another account in this department.'
      );
    }
  }

  if (targetUser) {
    // Include organizationId in the write as an additional tenant boundary.
    const result = await prisma.tenantUser.updateMany({
      where: {
        id: targetUser.id,
        organizationId,
      },
      data: {
        fullName,
        email,
        username,
        role,
        status,
        allowedTabs: tabsJsonString,
        ...(targetUser.email.trim().toLowerCase() !== email || targetUser.role !== role || status !== 'Active'
          ? { otpCode: null, otpExpires: null, otpAttempts: 0 }
          : {}),
      },
    });

    if (result.count !== 1) {
      throw new Error(
        'User could not be updated. Please refresh and try again.'
      );
    }
  } else {
    const suppliedUserId = String(formData.userId ?? '').trim();

    const generatedUserId =
      suppliedUserId ||
      `USR-${randomBytes(5).toString('hex').toUpperCase()}`;

    await prisma.tenantUser.create({
      data: {
        organizationId,
        userId: generatedUserId,
        fullName,
        email,
        username,
        role,
        status,
        allowedTabs: tabsJsonString,
      },
    });
  }

  await prisma.systemLog.create({ data: { organizationId, user: String((await auth())?.user?.email || 'Admin'), action: targetUser ? 'UPDATE_TENANT_USER' : 'CREATE_TENANT_USER', details: `${email}: role=${role}, status=${status}` } });
  revalidatePath(`/department/${department}/users`);

  return {
    success: true,
    message: targetUser
      ? 'User record updated successfully.'
      : 'User record created successfully.',
  };
}

// =========================================================================
// UPDATE USER ACCOUNT STATUS
// =========================================================================

export async function updateUserAccountStatus(
  userId: string,
  newStatus: 'Active' | 'Inactive' | 'Blocked',
  department: string
) {
  const cleanDepartment = normalizeDepartment(department);

  const access = await requireOrgAdmin(cleanDepartment);
  const organizationId = access.organizationId;

  const cleanUserId = String(userId ?? '').trim();

  if (!cleanUserId) {
    throw new Error('User ID is required.');
  }

  const status = normalizeUserStatus(newStatus);

  // Never look up a target account globally by ID alone.
  const targetUser = await prisma.tenantUser.findFirst({
    where: {
      id: cleanUserId,
      organizationId,
    },
  });

  if (!targetUser) {
    throw new Error('User not found in this department.');
  }

  if (
    isProtectedMasterAccount(targetUser.email) &&
    status !== 'Active'
  ) {
    throw new Error(
      'Action denied: Cannot deactivate or block the primary Super Admin account.'
    );
  }

  await preventLastAdminRemoval(organizationId, targetUser.id, targetUser.role, targetUser.status, targetUser.role, status);
  if (status !== 'Active' && await isActingOnOwnAccount(targetUser)) {
    throw new Error('You cannot deactivate or block your currently signed-in account.');
  }

  const result = await prisma.tenantUser.updateMany({
    where: {
      id: targetUser.id,
      organizationId,
    },
    data: {
      status,
      // Any status transition invalidates outstanding verification codes.
      otpCode: null,
      otpExpires: null,
      ...(status === 'Active' ? { otpAttempts: 0 } : {}),
    },
  });

  if (result.count !== 1) {
    throw new Error(
      'Account status could not be updated. Please refresh and try again.'
    );
  }

  await prisma.systemLog.create({ data: { organizationId, user: String((await auth())?.user?.email || 'Admin'), action: 'UPDATE_TENANT_USER_STATUS', details: `${targetUser.email} => ${status}` } });
  revalidatePath(`/department/${cleanDepartment}/users`);

  return {
    success: true,
    message: `Account status successfully updated to ${status}.`,
  };
}

// =========================================================================
// DELETE TENANT USER
// =========================================================================

export async function deleteTenantUser(
  userId: string,
  department: string
) {
  const cleanDepartment = normalizeDepartment(department);

  const access = await requireOrgAdmin(cleanDepartment);
  const organizationId = access.organizationId;

  const cleanUserId = String(userId ?? '').trim();

  if (!cleanUserId) {
    throw new Error('User ID is required.');
  }

  // Look up the target only within the authenticated administrator's tenant.
  const targetUser = await prisma.tenantUser.findFirst({
    where: {
      id: cleanUserId,
      organizationId,
    },
  });

  if (!targetUser) {
    throw new Error('User not found in this department.');
  }

  if (isProtectedMasterAccount(targetUser.email)) {
    throw new Error(
      'Action denied: Cannot delete the primary Super Admin account.'
    );
  }

  await preventLastAdminRemoval(organizationId, targetUser.id, targetUser.role, targetUser.status, 'viewer', 'Inactive');
  if (await isActingOnOwnAccount(targetUser)) {
    throw new Error('You cannot delete your currently signed-in account.');
  }

  const result = await prisma.tenantUser.deleteMany({
    where: {
      id: targetUser.id,
      organizationId,
    },
  });

  if (result.count !== 1) {
    throw new Error(
      'User account could not be deleted. Please refresh and try again.'
    );
  }

  await prisma.systemLog.create({ data: { organizationId, user: String((await auth())?.user?.email || 'Admin'), action: 'DELETE_TENANT_USER', details: `${targetUser.email}: ${targetUser.fullName}` } });
  revalidatePath(`/department/${cleanDepartment}/users`);

  return {
    success: true,
    message: 'User account successfully removed.',
  };
}