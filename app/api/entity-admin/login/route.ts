// /app/api/entity-admin/login/route.ts
//
// Two-step email sign-in for the Entity Admin portal.
//   step "request_otp": emails a 6-digit code to an active admin of an active
//     organization. The response is the same whether or not the email belongs to
//     an admin, so it can't be used to discover accounts.
//   step "verify_otp": checks the code and sets the portal session cookie.
// Codes are stored only as hashes (VerificationToken), expire in 5 minutes, and
// share the AuthThrottle resend cooldown and 15-minute lockout used everywhere else.

import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/mailer';
import { OTP_TTL_MS, hashOtp, otpHashMatches } from '@/lib/otp';
import {
  ThrottleError,
  assertCanSendOtp,
  assertNotLocked,
  clearOtpFailures,
  otpThrottleKey,
  recordOtpFailure,
  recordOtpSent,
} from '@/lib/auth-throttle';
import {
  ENTITY_SESSION_COOKIE,
  ENTITY_SESSION_TTL_MS,
  entityOtpIdentifier,
  signEntityToken,
} from '@/lib/entity-session';

const ADMIN_ROLES = ['admin', 'administrator', 'superadmin'];
const GENERIC_SENT =
  'If this email belongs to an Entity Administrator, a 6-digit code has been sent to it.';

/** An active admin account of an active organization, or null. */
function findEntityAdmin(email: string) {
  return prisma.tenantUser.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      role: { in: ADMIN_ROLES, mode: 'insensitive' },
      status: 'Active',
      organization: { status: 'Active' },
    },
    include: { organization: true },
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function fail(message: string, status: number) {
  return NextResponse.json({ success: false, message }, { status });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const step = String(body.step || 'request_otp');
    if (!email || !email.includes('@')) return fail('Administrator email address is required.', 400);

    const throttleKey = otpThrottleKey('entity-admin', email);
    const identifier = entityOtpIdentifier(email);

    if (step === 'request_otp') {
      await assertCanSendOtp(throttleKey);
      // Count every request toward the cooldown, admin or not.
      await recordOtpSent(throttleKey);

      const admin = await findEntityAdmin(email);
      if (admin) {
        const code = crypto.randomInt(100000, 1000000).toString();
        await prisma.verificationToken.upsert({
          where: { identifier },
          update: { token: hashOtp(code), expires: new Date(Date.now() + OTP_TTL_MS) },
          create: { identifier, token: hashOtp(code), expires: new Date(Date.now() + OTP_TTL_MS) },
        });
        try {
          await sendEmail({
            to: email,
            subject: 'CLEAR System: Entity Admin verification code',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #dee2e6; border-radius: 12px;">
                <h2 style="margin-top: 0;">Entity Admin Portal</h2>
                <p>Your verification code for the entity group of <strong>${escapeHtml(admin.organization.name)}</strong> is:</p>
                <div style="text-align: center; font-size: 28px; font-weight: bold; letter-spacing: 6px; margin: 20px 0;">${code}</div>
                <p style="font-size: 12px; color: #6c757d;">It expires in 5 minutes. If you didn't request it, ignore this email.</p>
              </div>`,
            text: `Your CLEAR Entity Admin verification code is ${code}. It expires in 5 minutes.`,
          });
        } catch {
          await prisma.verificationToken.deleteMany({ where: { identifier } });
          return fail('Unable to send the verification email. Please try again.', 502);
        }
      }
      return NextResponse.json({ success: true, message: GENERIC_SENT });
    }

    if (step === 'verify_otp') {
      await assertNotLocked(throttleKey);
      const code = String(body.otpCode || '').trim();
      const record = await prisma.verificationToken.findUnique({ where: { identifier } });

      if (!record || record.expires < new Date()) {
        return fail('The code has expired or was not requested. Request a new code.', 400);
      }
      if (!/^\d{6}$/.test(code) || !otpHashMatches(record.token, hashOtp(code))) {
        if (await recordOtpFailure(throttleKey)) {
          await prisma.verificationToken.deleteMany({ where: { identifier } });
          return fail('Too many failed attempts. Request a new code in 15 minutes.', 429);
        }
        return fail('Invalid verification code.', 401);
      }

      await prisma.verificationToken.deleteMany({ where: { identifier } });
      await clearOtpFailures(throttleKey);

      // Re-check the account: it may have been deactivated since the code was sent.
      if (!(await findEntityAdmin(email))) return fail('This account cannot use the Entity Admin portal.', 403);

      const cookieStore = await cookies();
      cookieStore.set(ENTITY_SESSION_COOKIE, signEntityToken({ email, exp: Date.now() + ENTITY_SESSION_TTL_MS }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: ENTITY_SESSION_TTL_MS / 1000,
      });
      return NextResponse.json({ success: true, message: 'Verified. Opening the Entity Admin Portal…' });
    }

    return fail('Invalid authentication step.', 400);
  } catch (error) {
    if (error instanceof ThrottleError) return fail(error.message, 429);
    console.error('Entity Admin Auth Error:', error);
    return fail('Sign-in failed. Please try again.', 500);
  }
}
