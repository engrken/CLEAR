// /app/department/[department]/auth-actions.ts
'use server';

import { prisma } from '@/lib/prisma';
import { issueDepartmentOtp } from '@/lib/department-otp';
import { requireTabAccess, isSuperAdminEmail } from '@/lib/permissions';
import { logSystemAction } from '@/lib/logger';

// All OTP issuing rules (cooldown, daily cap, Super Admin routing) live in lib/department-otp.ts.
// verifyOtp was removed on purpose: login is NextAuth signIn('credentials') only, so there is no
// second public endpoint that accepts code guesses.
export async function requestOtp(department: string, email: string) {
  return issueDepartmentOtp(department, email);
}

const ADMIN_ROLE_VALUES = ['admin', 'Admin', 'administrator', 'master'];
const isAdminRole = (role: unknown) =>
  ['admin', 'administrator', 'master'].includes(String(role || '').trim().toLowerCase());

// =========================================================
// ADMIN / SUPER ADMIN: UPDATE ACCOUNT STATUS & UNBLOCK
// Authorization comes from the DATABASE (membership of the target user's organization), not from
// the role string in the JWT, which can be hours stale and is stored in lowercase ('admin').
// =========================================================
export async function updateUserAccountStatus(
  targetUserId: string,
  newStatus: 'Active' | 'Inactive' | 'Blocked'
) {
  if (!['Active', 'Inactive', 'Blocked'].includes(newStatus)) {
    throw new Error('Invalid status.');
  }

  const target = await prisma.tenantUser.findUnique({ where: { id: String(targetUserId) } });
  if (!target) throw new Error('User not found.');

  const org = await prisma.organization.findUnique({
    where: { id: target.organizationId },
    select: { id: true, subdomain: true },
  });
  if (!org) throw new Error('User not found.');

  // Verifies the caller is an active member of THIS organization (or the Super Admin).
  const actor = await requireTabAccess('tab-users', org.subdomain);
  const actorIsSuper = Boolean(actor.isSuper);
  if (!actorIsSuper && !isAdminRole(actor.role)) {
    throw new Error('Only an Admin or Super Admin can change account status or unblock users.');
  }
  if (isSuperAdminEmail(target.email) && !actorIsSuper) {
    throw new Error('The system owner account cannot be modified.');
  }
  if (target.id === actor.id && newStatus !== 'Active') {
    throw new Error('You cannot deactivate or block your own account.');
  }

  // Never leave an organization without an active administrator.
  if (isAdminRole(target.role) && target.status === 'Active' && newStatus !== 'Active') {
    const others = await prisma.tenantUser.count({
      where: { organizationId: org.id, status: 'Active', role: { in: ADMIN_ROLE_VALUES }, NOT: { id: target.id } },
    });
    if (others === 0) throw new Error('At least one active administrator must remain.');
  }

  const res = await prisma.tenantUser.updateMany({
    where: { id: target.id, organizationId: org.id },
    data: {
      status: newStatus,
      ...(newStatus === 'Active'
        ? { otpAttempts: 0, otpCode: null, otpExpires: null }
        : { otpCode: null, otpExpires: null }),
    },
  });
  if (res.count !== 1) throw new Error('User not found.');

  if (newStatus === 'Active') {
    // Clears a temporary lockout if BLOCK_MODE is 'temporary' (harmless otherwise).
    await prisma.authThrottle.deleteMany({ where: { key: `dept-otp-lock:${target.id}` } });
  }

  await logSystemAction(
    org.id,
    actor.name,
    'UPDATE_ACCOUNT_STATUS',
    `Set ${target.username} (${target.fullName}) to ${newStatus}.`
  );

  return {
    success: true,
    message: `Account status for ${target.fullName} updated to ${newStatus}.`,
  };
}
