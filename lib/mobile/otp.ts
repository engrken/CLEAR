// /lib/mobile/otp.ts
//
// Officer sign-in codes for the mobile app. Issuing and checking codes is done
// by the web's own lib/department-otp.ts, so the app and the web share one code
// per officer, one 60 s cooldown, one 10-per-day cap and one lockout, and every
// reply is the same generic message whether or not the account exists.
//
// The only addition is the Google Play reviewer (lib/demo-reviewer.ts): the demo
// officer of the `demo` org gets the fixed DEMO_REVIEWER_CODE instead of an
// email. It is stored exactly like an emailed code (same HMAC as
// department-otp.ts), so verification, expiry and lockout are unchanged.

import 'server-only';
import crypto from 'node:crypto';
import type { Organization, TenantUser } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { issueDepartmentOtp, verifyDepartmentOtp } from '@/lib/department-otp';
import { isSuperAdminEmail } from '@/lib/super-admin';
import { demoReviewerCode } from '@/lib/demo-reviewer';
import { ApiFailure } from '@/lib/mobile/http';

const TTL_MS = 5 * 60 * 1000;
export const GENERIC_SENT = 'If the account is registered and active, a verification code has been sent.';

/** Must match digest() in lib/department-otp.ts. */
function departmentOtpDigest(code: string, userId: string) {
  const key = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!key || key.length < 32) throw new Error('OTP signing secret must be configured with at least 32 characters.');
  return crypto.createHmac('sha256', key).update(`dept-otp:${userId}:${code}`).digest('hex');
}

async function issueDemoReviewerCode(org: Pick<Organization, 'id'>, email: string, code: string) {
  const user = await prisma.tenantUser.findFirst({
    where: { organizationId: org.id, email: { equals: email, mode: 'insensitive' }, status: 'Active' },
  });
  if (!user) return;
  await prisma.tenantUser.update({
    where: { id: user.id },
    data: { otpCode: departmentOtpDigest(code, user.id), otpExpires: new Date(Date.now() + TTL_MS), otpAttempts: 0 },
  });
}

/**
 * Sends a sign-in code if the email belongs to an active officer of an active org.
 * Always the same reply; `sentTo` echoes the typed address for app 1.0.0, which shows it.
 */
export async function requestMobileCode(org: Pick<Organization, 'id' | 'subdomain'>, rawEmail: string) {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiFailure(400, 'invalid', 'Enter a valid email address.');
  // The platform super admin signs in on the web only.
  const reply = { message: GENERIC_SENT, sentTo: email };
  if (isSuperAdminEmail(email)) return reply;

  const demoCode = demoReviewerCode(org.subdomain, email);
  if (demoCode) {
    await issueDemoReviewerCode(org, email, demoCode);
    return reply;
  }
  try {
    await issueDepartmentOtp(org.subdomain, email);
  } catch (err) {
    throw new ApiFailure(502, 'send_failed', err instanceof Error ? err.message : 'The code could not be sent. Try again later.');
  }
  return reply;
}

/** Checks a code; returns the officer, or throws a generic 400. */
export async function verifyMobileCode(org: Pick<Organization, 'subdomain'>, rawEmail: string, code: string): Promise<TenantUser> {
  const email = String(rawEmail || '').trim().toLowerCase();
  if (isSuperAdminEmail(email)) throw new ApiFailure(400, 'invalid_code', 'Invalid or expired verification code.');
  const result = await verifyDepartmentOtp(org.subdomain, email, code);
  if (!result.ok) throw new ApiFailure(400, 'invalid_code', result.message);
  return result.user;
}
