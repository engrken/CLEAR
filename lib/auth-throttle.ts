// /lib/auth-throttle.ts
//
// OTP rate limiting and lockout (F7). One AuthThrottle row per identity:
//   - a new code can be requested at most once every RESEND_COOLDOWN_SECONDS;
//   - MAX_FAILED_ATTEMPTS wrong codes lock the identity for LOCKOUT_MINUTES and
//     invalidate the outstanding code. Requesting a new code does NOT reset the
//     failure counter, so the lockout cannot be bypassed by re-sending.

import { prisma } from '@/lib/prisma';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
export const RESEND_COOLDOWN_SECONDS = 60;

/** Thrown by the throttle checks; `code` lets API callers map it to a status. */
export class ThrottleError extends Error {
  constructor(message: string, public code: 'locked' | 'cooldown') {
    super(message);
    this.name = 'ThrottleError';
  }
}

export function otpThrottleKey(scope: string, email: string) {
  return `otp:${String(scope || '').trim().toLowerCase()}:${String(email || '').trim().toLowerCase()}`;
}

function minutesLeft(until: Date) {
  return Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60000));
}

/** Throws when the identity is locked out. */
export async function assertNotLocked(key: string) {
  const row = await prisma.authThrottle.findUnique({ where: { key } });
  if (row?.lockedUntil && row.lockedUntil > new Date()) {
    throw new ThrottleError(
      `Too many failed attempts. Try again in ${minutesLeft(row.lockedUntil)} minute(s).`,
      'locked'
    );
  }
  return row;
}

/** Call before sending a code: enforces lockout and the resend cooldown. */
export async function assertCanSendOtp(key: string) {
  const row = await assertNotLocked(key);
  if (row?.lastSentAt) {
    const elapsed = (Date.now() - row.lastSentAt.getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      throw new ThrottleError(
        `Please wait ${Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed)} seconds before requesting another code.`,
        'cooldown'
      );
    }
  }
}

export async function recordOtpSent(key: string) {
  await prisma.authThrottle.upsert({
    where: { key },
    update: { lastSentAt: new Date() },
    create: { key, lastSentAt: new Date() },
  });
}

/** Records a wrong code. Returns true when this failure triggered a lockout. */
export async function recordOtpFailure(key: string): Promise<boolean> {
  const row = await prisma.authThrottle.upsert({
    where: { key },
    update: { failedCount: { increment: 1 } },
    create: { key, failedCount: 1 },
  });

  if (row.failedCount >= MAX_FAILED_ATTEMPTS) {
    await prisma.authThrottle.update({
      where: { key },
      data: {
        failedCount: 0,
        lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000),
      },
    });
    return true;
  }
  return false;
}

export async function clearOtpFailures(key: string) {
  await prisma.authThrottle.updateMany({
    where: { key },
    data: { failedCount: 0, lockedUntil: null },
  });
}
