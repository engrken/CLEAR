// lib/super-admin-otp.ts  (NEW)
// Super Admin OTP issue + verify. Uses ONLY tables you already have:
//   VerificationToken  -> the hashed code (identifier is the primary key)
//   AuthThrottle       -> attempt budget, lock, and send throttle (no migration needed)
//
// Every limit is enforced by a CONDITIONAL updateMany (count === 1 means "admitted"), so parallel
// requests cannot slip past a read-then-write race.
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/mailer';
import { isSuperAdminEmail } from '@/lib/super-admin';

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
const hash = (code: string) => crypto.createHash('sha256').update(code).digest('hex');
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
  if (!isSuperAdminEmail(e)) return generic;           // same answer, nothing is sent

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
    await prisma.verificationToken.deleteMany({ where: { identifier: e } });
  }
  return generic;
}

// ----------------------------------------------------------------- VERIFY
export async function verifySuperAdminOtp(
  email: string,
  code: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const e = norm(email);
  if (!isSuperAdminEmail(e)) return { ok: false, message: FAIL };

  const now = new Date();
  const key = guessKey(e);

  // A guess only counts when a live code exists (that is the only time a guess can succeed).
  const tok = await prisma.verificationToken.findUnique({ where: { identifier: e } });
  if (!tok || tok.expires < now) return { ok: false, message: FAIL };

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

  // Single use, even if two correct submissions race.
  const consumed = await prisma.verificationToken.deleteMany({
    where: { identifier: e, token: tok.token },
  });
  if (consumed.count !== 1) return { ok: false, message: FAIL };

  await prisma.authThrottle.updateMany({
    where: { key },
    data: { failedCount: 0, lockedUntil: null, updatedAt: now },
  });
  return { ok: true };
}
