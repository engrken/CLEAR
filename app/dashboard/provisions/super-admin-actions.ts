'use server';

import { prisma } from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/permissions';
import { isReservedGlobalAdminEmail, isSuperAdminEmail, normalizeGlobalAdminEmail } from '@/lib/super-admin';
import { revalidatePath } from 'next/cache';
import { sendEmail } from '@/lib/mailer';

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


export async function inviteGlobalAdmin(formData: FormData) {
  const actor = await requireSuperAdmin();
  const actorEmail = normalizeGlobalAdminEmail(actor.email);
  const email = normalizeGlobalAdminEmail(formData.get('email'));
  const fullName = String(formData.get('fullName') || '').trim();
  if (!EMAIL.test(email) || email.length > 254) throw new Error('Enter a valid administrator email.');
  if (fullName.length < 2 || fullName.length > 120) throw new Error('Administrator name must have 2–120 characters.');
  if (email === actorEmail || (await isReservedGlobalAdminEmail(email)))
    throw new Error('This email is already reserved for a global administrator.');
  // Separate from all tenant memberships: avoid ambiguous login and privilege scopes.
  const tenantMembership = await prisma.tenantUser.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true },
  });
  if (tenantMembership) throw new Error('This email is already a tenant member. Use a distinct global administrator email.');

  await prisma.$transaction(async (tx) => {
    await tx.globalSuperAdmin.create({ data: {
      email, fullName, status: 'Pending', invitedBy: actorEmail,
      invitationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    } });
    await tx.globalAdminAudit.create({ data: {
      actorEmail, targetEmail: email, action: 'INVITE_GLOBAL_ADMIN',
      details: 'Invitation awaits first verified email OTP, expires in 7 days',
    } });
  });
  await sendGlobalAdminInvitation(email, fullName);
  refresh();
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
