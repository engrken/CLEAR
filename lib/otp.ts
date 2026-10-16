// /lib/otp.ts
//
// Department officer sign-in codes: the one implementation used by the web login
// (auth-actions.requestOtp + auth.ts authorize) and the mobile API. Codes are
// 6 digits, single use, valid 5 minutes, stored only as SHA-256 hashes, and
// throttled per identity (lib/auth-throttle.ts). The Play reviewer's demo
// officer gets a fixed code instead of an email (lib/demo-reviewer.ts); it is
// checked by the same verifyDepartmentOtp as every other code.

import crypto from 'node:crypto';
import type { Organization, TenantUser } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/mailer';
import { demoReviewerCode } from '@/lib/demo-reviewer';
import {
  ThrottleError,
  assertCanSendOtp,
  assertNotLocked,
  clearOtpFailures,
  otpThrottleKey,
  recordOtpFailure,
  recordOtpSent,
} from '@/lib/auth-throttle';

export const OTP_TTL_MS = 5 * 60 * 1000;

export type OtpErrorCode =
  | 'not_officer'
  | 'cooldown'
  | 'locked'
  | 'no_code'
  | 'expired'
  | 'mismatch'
  | 'send_failed';

export class OtpError extends Error {
  constructor(message: string, public code: OtpErrorCode) {
    super(message);
    this.name = 'OtpError';
  }
}

export function hashOtp(code: string) {
  return crypto.createHash('sha256').update(String(code).trim()).digest('hex');
}

/** Timing-safe comparison of two hex digests. */
export function otpHashMatches(storedHash: string | null | undefined, submittedHash: string) {
  const a = Buffer.from(String(storedHash || '').trim(), 'utf8');
  const b = Buffer.from(submittedHash, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function findOrganizationBySlug(slug: string) {
  return prisma.organization.findFirst({
    where: { subdomain: { equals: String(slug || '').trim().toLowerCase(), mode: 'insensitive' } },
  });
}

async function findActiveOfficer(organizationId: string, email: string) {
  return prisma.tenantUser.findFirst({
    where: {
      organizationId,
      email: { equals: email, mode: 'insensitive' },
      status: 'Active',
    },
  });
}

function rethrowThrottle(err: unknown): never {
  if (err instanceof ThrottleError) throw new OtpError(err.message, err.code);
  throw err;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Generates, stores and emails a new code for an active officer of `org`. */
export async function sendDepartmentOtp(
  org: Pick<Organization, 'id' | 'name' | 'subdomain'>,
  rawEmail: string
): Promise<{ user: TenantUser }> {
  const email = String(rawEmail || '').trim().toLowerCase();
  const user = await findActiveOfficer(org.id, email);
  if (!user) {
    throw new OtpError('This account is not registered or is currently inactive.', 'not_officer');
  }

  const throttleKey = otpThrottleKey(org.subdomain, email);
  await assertCanSendOtp(throttleKey).catch(rethrowThrottle);

  const demoCode = demoReviewerCode(org.subdomain, email);
  const otp = demoCode ?? crypto.randomInt(100000, 1000000).toString();
  await prisma.tenantUser.update({
    where: { id: user.id },
    data: { otpCode: hashOtp(otp), otpExpires: new Date(Date.now() + OTP_TTL_MS) },
  });

  // The demo officer's address has no inbox; the reviewer has the code already.
  if (demoCode) {
    await recordOtpSent(throttleKey);
    return { user };
  }

  try {
    await sendEmail({
      to: email,
      subject: `CLEAR System: ${org.name} Verification Code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background: #f8f9fa;">
          <div style="background: #ffffff; border-radius: 12px; padding: 30px; border: 1px solid #dee2e6;">
            <h2 style="margin-top: 0; color: #212529;">CLEAR System</h2>
            <p>Hello <strong>${escapeHtml(user.fullName)}</strong>,</p>
            <p>Your verification code for <strong>${escapeHtml(org.name)}</strong> is:</p>
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; padding: 15px 25px; font-size: 32px; font-weight: bold; letter-spacing: 8px; background: #f1f3f5; border-radius: 10px; color: #212529;">
                ${otp}
              </div>
            </div>
            <p>This verification code will expire in <strong>5 minutes</strong>.</p>
          </div>
        </div>
      `,
      text: `Your CLEAR System verification code for ${org.name} is: ${otp}`,
    });
  } catch {
    await prisma.tenantUser.update({
      where: { id: user.id },
      data: { otpCode: null, otpExpires: null },
    });
    throw new OtpError('Unable to send verification email. Please try again.', 'send_failed');
  }

  await recordOtpSent(throttleKey);
  return { user };
}

/**
 * Checks a submitted code. On success the code is consumed and the officer is
 * returned; wrong codes count toward the lockout, which also voids the code.
 */
export async function verifyDepartmentOtp(
  org: Pick<Organization, 'id' | 'subdomain'>,
  rawEmail: string,
  rawCode: string
): Promise<TenantUser> {
  const email = String(rawEmail || '').trim().toLowerCase();
  const code = String(rawCode || '').trim();

  const user = await findActiveOfficer(org.id, email);
  if (!user) {
    throw new OtpError('This account is not authorized for this department.', 'not_officer');
  }

  const throttleKey = otpThrottleKey(org.subdomain, email);
  await assertNotLocked(throttleKey).catch(rethrowThrottle);

  if (!user.otpCode) {
    throw new OtpError('No department verification code requested.', 'no_code');
  }
  if (!user.otpExpires || user.otpExpires < new Date()) {
    throw new OtpError('Verification code has expired.', 'expired');
  }

  if (!otpHashMatches(user.otpCode, hashOtp(code))) {
    if (await recordOtpFailure(throttleKey)) {
      await prisma.tenantUser.update({
        where: { id: user.id },
        data: { otpCode: null, otpExpires: null },
      });
      throw new OtpError('Too many failed attempts. Request a new code in 15 minutes.', 'locked');
    }
    throw new OtpError('Invalid verification code.', 'mismatch');
  }

  await prisma.tenantUser.update({
    where: { id: user.id },
    data: { otpCode: null, otpExpires: null },
  });
  await clearOtpFailures(throttleKey);
  return user;
}
