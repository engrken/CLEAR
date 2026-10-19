'use server';

import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/permissions';
import { isReservedGlobalAdminEmail, isSuperAdminEmail, normalizeGlobalAdminEmail } from '@/lib/super-admin';
import { revalidatePath } from 'next/cache';
import { sendEmail } from '@/lib/mailer';
import { validateTenantPromotion } from '@/lib/global-admin-promotion-policy';

const MANAGE_PATH = '/dashboard/provisions';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function refresh() { revalidatePath(MANAGE_PATH); }
async function sendGlobalAdminInvitation(email: string, name: string) {
  // Notification only; NEVER email a login token or impersonation link.
  // If SMTP is unavailable, authorization remains Pending and the admin can
  // request an OTP directly from System SuperAdmin Access.
  try {
    await sendEmail({
      to: email,
      subject: 'CLEAR System — Global Super Admin Invitation',
      text: `Hello ${name}, you have been invited as a CLEAR System global Super Admin. Open the official CLEAR dashboard and select System SuperAdmin Access. Enter this email address to request your own single-use verification code. This invitation expires after seven days. If unexpected, contact the system owner.`,
      html: `<div style="font:14px Arial,sans-serif;max-width:560px;margin:auto;padding:20px">
        <h2 style="color:#0b7292">CLEAR Global Super Admin Invitation</h2>
        <p>You've been invited to administer the CLEAR platform.</p>
        <p>Open the official CLEAR dashboard and choose <strong>System SuperAdmin Access</strong>.
           Use the invited email address to request and verify your personal one-time code.</p>
        <p>This invitation expires in 7 days. If you did not expect it, contact the system owner.</p>
      </div>`,
    });
  } catch (err) {
    console.error('Global Super Admin invitation notification unavailable:', err);
  }
}


export type GlobalAdminInviteState = {
  status: 'idle' | 'error' | 'success';
  message: string;
};

class InviteValidationError extends Error {}

export async function inviteGlobalAdmin(
  _previousState: GlobalAdminInviteState,
  formData: FormData,
): Promise<GlobalAdminInviteState> {
  // Server-only Super Admin authorization cannot be bypassed by the client.
  const actor = await requireSuperAdmin();
  const actorEmail = normalizeGlobalAdminEmail(actor.email);
  const email = normalizeGlobalAdminEmail(formData.get('email'));
  const suppliedName = String(formData.get('fullName') || '').trim();
  const promoteTenant = formData.get('promoteExistingTenant') === 'on';

  try {
    if (!EMAIL.test(email) || email.length > 254)
      throw new InviteValidationError('Enter a valid administrator email.');
    if (suppliedName.length < 2 || suppliedName.length > 120)
      throw new InviteValidationError('Administrator name must have 2–120 characters.');
    if (email === actorEmail || isSuperAdminEmail(email))
      throw new InviteValidationError('The original Super Admin account cannot be invited or modified.');

    // A serializable DB transaction ensures that invitation, legacy OTP
    // invalidation, mobile-session revocation and audit entry happen together.
    const invite = await prisma.$transaction(async tx => {
      const existing = await tx.globalSuperAdmin.findUnique({ where: { email } });
      if (existing) throw new InviteValidationError(
        'This email is already registered as a global administrator (' + existing.status + ').'
      );

      const memberships = await tx.tenantUser.findMany({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true, organizationId: true, fullName: true, role: true, status: true },
      });
      if (memberships.length && !promoteTenant) {
        throw new InviteValidationError(
          'This is an existing tenant account. Check "Promote existing tenant" to authorize its promotion.'
        );
      }
      if (promoteTenant && !memberships.length) {
        throw new InviteValidationError(
          'No tenant account was found for this email. Uncheck promotion to invite a new administrator.'
        );
      }

      if (promoteTenant) {
        const orgIds = Array.from(new Set(memberships.map(m => m.organizationId)));
        const candidates = await tx.tenantUser.findMany({
          where: { organizationId: { in: orgIds }, status: 'Active' },
          select: { id: true, organizationId: true, email: true, role: true, status: true },
        });
        const existingGlobals = await tx.globalSuperAdmin.findMany({
          where: { email: { in: candidates.map(u => u.email.trim().toLowerCase()) } },
          select: { email: true },
        });
        const globalEmails = new Set(existingGlobals.map(u => u.email));
        const policyError = validateTenantPromotion(
          memberships,
          candidates.map(u => ({
            ...u,
            reservedGlobalAdmin:
              isSuperAdminEmail(u.email) || globalEmails.has(u.email.trim().toLowerCase()),
          })),
        );
        if (policyError) throw new InviteValidationError(policyError);
      }

      const fullName = promoteTenant ? memberships[0].fullName.trim() : suppliedName;
      if (fullName.length < 2 || fullName.length > 120) {
        throw new InviteValidationError('The tenant profile name must have 2–120 characters.');
      }

      await tx.globalSuperAdmin.create({ data: {
        email, fullName, status: 'Pending', invitedBy: actorEmail,
        invitationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      } });

      if (promoteTenant) {
        const memberIds = memberships.map(m => m.id);
        // Preserve TenantUser records and transaction attribution.
        // Existing tenant OTPs and mobile sessions must not remain usable.
        await tx.tenantUser.updateMany({
          where: { id: { in: memberIds } },
          data: { otpCode: null, otpExpires: null, otpAttempts: 0 },
        });
        await tx.mobileSession.updateMany({
          where: { tenantUserId: { in: memberIds }, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      await tx.globalAdminAudit.create({ data: {
        actorEmail, targetEmail: email,
        action: promoteTenant ? 'PROMOTE_TENANT_TO_GLOBAL_ADMIN' : 'INVITE_GLOBAL_ADMIN',
        details: promoteTenant
          ? 'Tenant memberships preserved; tenant OTPs and mobile sessions invalidated. First global OTP activation required.'
          : 'Invitation awaits first verified email OTP; expires in seven days.',
      } });
      return { fullName, promoted: promoteTenant };
    });

    await sendGlobalAdminInvitation(email, invite.fullName);
    refresh();
    return {
      status: 'success',
      message: invite.promoted
        ? 'Promotion invitation created. The tenant record is preserved; this email will now use global Super Admin OTP after verification.'
        : 'Global Super Admin invitation created. The person must activate it using their own email OTP.',
    };
  } catch (error) {
    if (error instanceof InviteValidationError)
      return { status: 'error', message: error.message };
    console.error('Global Super Admin invitation failed:', error);
    return { status: 'error', message: 'Unable to save the invitation. Check the account details and try again.' };
  }
}

export async function renewGlobalAdminInvitation(formData: FormData) {
  const actor = await requireSuperAdmin();
  const actorEmail = normalizeGlobalAdminEmail(actor.email);
  const id = String(formData.get('id') || '').trim();
  if (!id || id.length > 128) throw new Error('Invalid invitation target.');
  const target = await prisma.$transaction(async tx => {
    const found = await tx.globalSuperAdmin.findUnique({ where: { id } });
    if (!found || found.status !== 'Pending' || found.email === actorEmail)
      throw new Error('Only a pending invitation may be renewed.');
    const changed = await tx.globalSuperAdmin.updateMany({
      where: { id, status: 'Pending', sessionVersion: found.sessionVersion },
      data: { invitationExpiresAt: new Date(Date.now() + 7*24*60*60*1000),
        sessionVersion: { increment: 1 } },
    });
    if (changed.count !== 1) throw new Error('Invitation changed concurrently.');
    await tx.verificationToken.deleteMany({ where: { identifier: found.email } });
    await tx.globalAdminAudit.create({ data: {
      actorEmail, targetEmail: found.email, action: 'RENEW_GLOBAL_ADMIN_INVITATION',
    } });
    return found;
  });
  await sendGlobalAdminInvitation(target.email, target.fullName);
  refresh();
}

export async function updateGlobalAdminStatus(formData: FormData) {
  const actor = await requireSuperAdmin();
  const actorEmail = normalizeGlobalAdminEmail(actor.email);
  const id = String(formData.get('id') || '').trim();
  const command = String(formData.get('command') || '');
  if (!id || id.length > 128 || !['disable', 'enable', 'revoke'].includes(command))
    throw new Error('Invalid global administrator action.');

  await prisma.$transaction(async (tx) => {
    const target = await tx.globalSuperAdmin.findUnique({ where: { id } });
    if (!target) throw new Error('Global administrator not found.');
    if (target.email === actorEmail || isSuperAdminEmail(target.email))
      throw new Error('You cannot change your own or the bootstrap Super Admin account.');

    const allowed =
      (command === 'disable' && ['Active', 'Pending'].includes(target.status)) ||
      (command === 'enable' && target.status === 'Disabled') ||
      (command === 'revoke' && target.status !== 'Revoked');
    if (!allowed) throw new Error('Invalid status transition.');

    const nextStatus = command === 'disable' ? 'Disabled' :
      command === 'enable' ? (target.activatedAt ? 'Active' : 'Pending') : 'Revoked';
    const now = new Date();
    const changed = await tx.globalSuperAdmin.updateMany({
      where: { id, status: target.status, sessionVersion: target.sessionVersion },
      data: {
        status: nextStatus, sessionVersion: { increment: 1 },
        disabledAt: command === 'disable' ? now : null,
        ...(command === 'enable' && !target.activatedAt ? {
          invitationExpiresAt: new Date(now.getTime() + 7*24*60*60*1000),
        } : {}),
        ...(command === 'revoke' ? { revokedAt: now } : {}),
      },
    });
    if (changed.count !== 1) throw new Error('Account changed concurrently; reload and retry.');
    await tx.verificationToken.deleteMany({ where: { identifier: target.email } });
    await tx.globalAdminAudit.create({ data: {
      actorEmail, targetEmail: target.email,
      action: command === 'disable' ? 'DISABLE_GLOBAL_ADMIN' :
        command === 'enable' ? 'ENABLE_GLOBAL_ADMIN' : 'REVOKE_GLOBAL_ADMIN',
    } });
  });
  refresh();
}
