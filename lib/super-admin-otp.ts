// lib/super-admin-otp.ts 

import 'server-only';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/mailer';
import { findEligibleGlobalAdmin, isSuperAdminEmail, type GlobalIdentity } from '@/lib/super-admin';

const TTL_MS = 5 * 60 * 1000;
const MAX_GUESSES = 5;                       // wrong codes allowed per cycle
const LOCK_MS = 30 * 60 * 1000;              // lock after the budget is used up
const SEND_COOLDOWN_MS = 60 * 1000;          // min gap between emails
const SEND_WINDOW_MS = 60 * 60 * 1000;
const MAX_SENDS_PER_WINDOW = 5;              // emails per hour

export const SENT_MESSAGE =
  'If this email is authorized, a verification code has been sent. ' +
  'If you entered several wrong codes recently, wait 30 minutes before trying again.';
const FAIL = 'Invalid or expired verification code.';

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
const hash = (code: string) => {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('OTP signing secret must be configured with at least 32 characters.');
  return crypto.createHmac('sha256', secret).update('super-admin-otp:' + code).digest('hex');
};
const guessKey = (e: string) => `super-admin-otp:guess:${e}`;
const sendKey = (e: string) => `super-admin-otp:send:${e}`;

function safeEqual(a: string, b: string) {
  const A = Buffer.from(a, 'utf8');
  const B = Buffer.from(b, 'utf8');
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

// ------------------------------------------------------------------ ISSUE
export async function issueSuperAdminOtp(email: string) {
  const generic = { success: true as const, message: SENT_MESSAGE };
  const e = norm(email);
  if (!(await findEligibleGlobalAdmin(e))) return generic;           // same answer, nothing is sent

  const now = new Date();

  // No new codes while locked (stops an attacker from feeding themselves fresh codes).
  const lock = await prisma.authThrottle.findUnique({ where: { key: guessKey(e) } });
  if (lock?.lockedUntil && lock.lockedUntil > now) return generic;

  // Send budget. Columns are reused: failedCount = sends in window, lastSentAt = window start,
  // updatedAt = time of last send.
  const sKey = sendKey(e);
  await prisma.authThrottle.upsert({
    where: { key: sKey },
    create: { key: sKey, failedCount: 0, lastSentAt: now, updatedAt: new Date(0) },
    update: {},
  });
  await prisma.authThrottle.updateMany({
    where: { key: sKey, lastSentAt: { lte: new Date(now.getTime() - SEND_WINDOW_MS) } },
    data: { failedCount: 0, lastSentAt: now },
  });
  const admitted = await prisma.authThrottle.updateMany({
    where: {
      key: sKey,
      failedCount: { lt: MAX_SENDS_PER_WINDOW },
      updatedAt: { lte: new Date(now.getTime() - SEND_COOLDOWN_MS) },
    },
    data: { failedCount: { increment: 1 }, updatedAt: now },
  });
  if (admitted.count !== 1) return generic;            // cooldown or hourly cap hit

  const code = crypto.randomInt(100000, 1000000).toString();
  const expires = new Date(now.getTime() + TTL_MS);
  await prisma.verificationToken.upsert({
    where: { identifier: e },
    create: { identifier: e, token: hash(code), expires },
    update: { token: hash(code), expires },
  });

  try {
    await sendEmail({
      to: e,
      subject: 'CLEAR System: System Admin Verification Code',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e0e0e0;border-radius:8px;">
          <h2 style="color:#0dcaf0;margin-bottom:20px;">CLEAR System Authorization</h2>
          <p style="color:#555;font-size:15px;">You are attempting to access the System Admin Setup Module.</p>
          <p style="color:#555;font-size:15px;">Your one-time verification code is:</p>
          <div style="background:#f8f9fa;padding:15px;text-align:center;border-radius:6px;margin:25px 0;">
            <h1 style="letter-spacing:8px;margin:0;color:#212529;font-size:32px;">${code}</h1>
          </div>
          <p style="color:#777;font-size:13px;margin-top:30px;">
            This code expires in 5 minutes. If you did not request this access, ignore this email.
          </p>
        </div>`,
      text: `Your CLEAR System verification code is: ${code}`,
    });
  } catch (err) {
    console.error('Super Admin OTP email failed:', err);
    await prisma.verificationToken.deleteMany({ where: { identifier: e, token: hash(code) } });
  }
  return generic;
}

// ----------------------------------------------------------------- VERIFY
export async function verifySuperAdminOtp(
  email: string,
  code: string
): Promise<{ ok: true; identity: GlobalIdentity } | { ok: false; message: string }> {
  const e = norm(email);
  if (!(await findEligibleGlobalAdmin(e))) return { ok: false, message: FAIL };

  const now = new Date();
  const key = guessKey(e);

  // A guess only counts when a live code exists (that is the only time a guess can succeed).
  const tok = await prisma.verificationToken.findUnique({ where: { identifier: e } });
  if (!tok || tok.expires < now || !/^\d{6}$/.test(code)) return { ok: false, message: FAIL };

  // New cycle once a lock has expired.
  await prisma.authThrottle.updateMany({
    where: { key, lockedUntil: { lte: now } },
    data: { failedCount: 0, lockedUntil: null, updatedAt: now },
  });
  await prisma.authThrottle.upsert({
    where: { key },
    create: { key, failedCount: 0, updatedAt: now },
    update: {},
  });

  // Atomic admission: only the first MAX_GUESSES attempts of a cycle get through, even in parallel.
  const admitted = await prisma.authThrottle.updateMany({
    where: { key, failedCount: { lt: MAX_GUESSES }, lockedUntil: null },
    data: { failedCount: { increment: 1 }, updatedAt: now },
  });
  if (admitted.count !== 1) {
    // Budget used up. Make sure a lock timestamp exists (self-heals if a handler died mid-way).
    await prisma.authThrottle.updateMany({
      where: { key, lockedUntil: null, failedCount: { gte: MAX_GUESSES } },
      data: { lockedUntil: new Date(now.getTime() + LOCK_MS), updatedAt: now },
    });
    return { ok: false, message: 'Too many incorrect attempts. Please wait 30 minutes and request a new code.' };
  }

  if (!safeEqual(tok.token, hash(code))) {
    const row = await prisma.authThrottle.findUnique({ where: { key } });
    if (row && row.failedCount >= MAX_GUESSES) {
      await prisma.authThrottle.updateMany({
        where: { key, lockedUntil: null },
        data: { lockedUntil: new Date(now.getTime() + LOCK_MS), updatedAt: now },
      });
      await prisma.verificationToken.deleteMany({ where: { identifier: e } });
      return { ok: false, message: 'Too many incorrect attempts. Please wait 30 minutes and request a new code.' };
    }
    return { ok: false, message: FAIL };
  }

  // The one-time token and membership activation are checked atomically.
  // A disabled or revoked account cannot use an OTP issued before revocation.
  const identity = await prisma.$transaction(async (tx): Promise<GlobalIdentity | null> => {
    const consumed = await tx.verificationToken.deleteMany({
      where: { identifier: e, token: tok.token, expires: { gt: now } },
    });
    if (consumed.count !== 1) return null;

    if (isSuperAdminEmail(e)) {
      await tx.globalAdminAudit.create({ data: {
        actorEmail: e, targetEmail: e, action: 'BOOTSTRAP_GLOBAL_SIGN_IN',
      } });
      return {
        id: 'bootstrap', email: e, fullName: 'Primary Super Admin',
        sessionVersion: 1, source: 'bootstrap',
      };
    }
    const account = await tx.globalSuperAdmin.findUnique({ where: { email: e } });
    if (!account) return null;
    const where = account.status === 'Pending'
      ? { id: account.id, status: 'Pending', invitationExpiresAt: { gt: now } }
      : { id: account.id, status: 'Active' };
    const activated = await tx.globalSuperAdmin.updateMany({
      where,
      data: {
        status: 'Active',
        ...(account.status === 'Pending' ? { activatedAt: now } : {}),
        lastLoginAt: now,
      },
    });
    if (activated.count !== 1) return null;
    await tx.globalAdminAudit.create({
      data: { actorEmail: e, targetEmail: e,
        action: account.status === 'Pending' ? 'ACTIVATE_GLOBAL_ADMIN' : 'GLOBAL_ADMIN_SIGN_IN' },
    });
    return { id: account.id, email: e, fullName: account.fullName,
      sessionVersion: account.sessionVersion, source: 'database' };
  });
  if (!identity) return { ok: false, message: FAIL };
  await prisma.authThrottle.updateMany({
    where: { key },
    data: { failedCount: 0, lockedUntil: null, updatedAt: now },
  });
  return { ok: true, identity };
}
