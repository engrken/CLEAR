// lib/department-otp.ts  (NEW)
// Department-officer OTP: issue + verify. Uses ONLY fields you already have on TenantUser
// (otpCode, otpExpires, otpAttempts, otpRequestCount, otpLastRequestedAt, status) plus the
// AuthThrottle table. No migration needed.
//
// Fixes vs. the previous code:
//  * attempts are counted with an ATOMIC increment (read-then-write could be raced by parallel guesses)
//  * the 60 s cooldown and the 10/day cap are enforced by one conditional UPDATE (parallel requests
//    cannot flood the inbox or overwrite each other's code)
//  * by default the responses no longer reveal whether an account exists / is blocked / is throttled
//  * optional temporary lockout so a stranger cannot permanently block an officer
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/mailer';
import { sanitizeHTML } from '@/lib/utils';
import { isSuperAdminEmail } from '@/lib/super-admin';
import { issueSuperAdminOtp } from '@/lib/super-admin-otp';

// ------------------------------------------------------------------ POLICY KNOBS
const TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_REQUESTS_PER_DAY = 10;
const WINDOW_MS = 24 * 60 * 60 * 1000;

/** 'permanent' = status becomes 'Blocked' and only an Admin can unblock (your current behavior).
 *  'temporary' = locked for LOCKOUT_MS, no admin needed. Recommended: with 'permanent', anyone who
 *  knows an officer's email can lock that officer (or the only admin) out. */
const BLOCK_MODE: 'permanent' | 'temporary' = 'permanent';
const LOCKOUT_MS = 30 * 60 * 1000;

/** false = identical, non-revealing messages (recommended).
 *  true  = your original detailed messages (blocked, inactive, attempts remaining, daily limit). */
const VERBOSE_ERRORS = false;

// ------------------------------------------------------------------ HELPERS
const GENERIC_SENT = 'If this account is registered and active, a verification code has been sent to its email address.';
const GENERIC_FAIL = 'Invalid or expired verification code.';
const GENERIC_LOCKED = 'Too many incorrect attempts. Please try again later.';

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
const normDept = (v: unknown) => {
  let d = String(v ?? '');
  try { d = decodeURIComponent(d); } catch { /* keep raw */ }
  return d.trim().toLowerCase();
};
const hash = (code: string) => crypto.createHash('sha256').update(code).digest('hex');
const lockKey = (userId: string) => `dept-otp-lock:${userId}`;

function safeEqual(a: string, b: string) {
  const A = Buffer.from(a, 'utf8');
  const B = Buffer.from(b, 'utf8');
  return A.length === B.length && crypto.timingSafeEqual(A, B);
}

export function parseTabs(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
    } catch { return []; }
  }
  return [];
}

function denyRequest(detailed: string) {
  if (VERBOSE_ERRORS) throw new Error(detailed);
  return { success: true as const, message: GENERIC_SENT };
}
function denyVerify(detailed: string) {
  return { ok: false as const, message: VERBOSE_ERRORS ? detailed : GENERIC_FAIL };
}

const BLOCKED_MSG =
  'ACCOUNT BLOCKED: Maximum failed login attempts (5) exceeded. Only an Admin or Super Admin can unblock your account.';
const INACTIVE_MSG = 'This account is currently inactive. Please contact your administrator.';

async function isTemporarilyLocked(userId: string, now: Date) {
  if (BLOCK_MODE !== 'temporary') return false;
  const row = await prisma.authThrottle.findUnique({ where: { key: lockKey(userId) } });
  return Boolean(row?.lockedUntil && row.lockedUntil > now);
}

async function lockUser(userId: string, now: Date) {
  if (BLOCK_MODE === 'permanent') {
    await prisma.tenantUser.update({
      where: { id: userId },
      data: { status: 'Blocked', otpAttempts: MAX_ATTEMPTS, otpCode: null, otpExpires: null },
    });
  } else {
    await prisma.tenantUser.update({
      where: { id: userId },
      data: { otpAttempts: 0, otpCode: null, otpExpires: null },
    });
    const until = new Date(now.getTime() + LOCKOUT_MS);
    await prisma.authThrottle.upsert({
      where: { key: lockKey(userId) },
      create: { key: lockKey(userId), failedCount: MAX_ATTEMPTS, lockedUntil: until, updatedAt: now },
      update: { failedCount: MAX_ATTEMPTS, lockedUntil: until, updatedAt: now },
    });
  }
}

// ------------------------------------------------------------------ ISSUE
export async function issueDepartmentOtp(department: string, email: string) {
  const e = norm(email);
  if (!e || !e.includes('@')) throw new Error('Please provide a valid email address.');

  // Super Admin has its own, stricter path.
  if (isSuperAdminEmail(e)) return issueSuperAdminOtp(e);

  const org = await prisma.organization.findFirst({
    where: { subdomain: { equals: normDept(department), mode: 'insensitive' } },
    select: { id: true, name: true, status: true },
  });
  if (!org) return denyRequest('Department not found.');

  const user = await prisma.tenantUser.findFirst({
    where: { organizationId: org.id, email: { equals: e, mode: 'insensitive' } },
  });
  if (!user) return denyRequest('This account is not registered under this department.');
  if (user.status === 'Blocked') return denyRequest(BLOCKED_MSG);
  if (user.status !== 'Active') return denyRequest(INACTIVE_MSG);
  if (org.status && org.status !== 'Active') {
    return denyRequest(`This department is currently ${org.status.toLowerCase()} and cannot be accessed.`);
  }

  const now = new Date();
  if (await isTemporarilyLocked(user.id, now)) return denyRequest('Too many incorrect attempts. Please try again later.');

  // Start a fresh 24 h window when the old one ended.
  const windowCutoff = new Date(now.getTime() - WINDOW_MS);
  await prisma.tenantUser.updateMany({
    where: { id: user.id, OR: [{ otpLastRequestedAt: null }, { otpLastRequestedAt: { lte: windowCutoff } }] },
    data: { otpRequestCount: 0, otpLastRequestedAt: now },
  });

  // ONE conditional update enforces both the cooldown and the daily cap, even for parallel requests.
  // Cooldown: the pending code was issued at (otpExpires - TTL); it must be at least RESEND_COOLDOWN ago.
  const cooldownCutoff = new Date(now.getTime() + TTL_MS - RESEND_COOLDOWN_MS);
  const code = crypto.randomInt(100000, 1000000).toString();
  const admitted = await prisma.tenantUser.updateMany({
    where: {
      id: user.id,
      otpRequestCount: { lt: MAX_REQUESTS_PER_DAY },
      OR: [{ otpExpires: null }, { otpExpires: { lte: cooldownCutoff } }],
    },
    data: {
      otpCode: hash(code),
      otpExpires: new Date(now.getTime() + TTL_MS),
      otpAttempts: 0,
      otpRequestCount: { increment: 1 },
    },
  });
  if (admitted.count !== 1) {
    const capped = (user.otpRequestCount || 0) >= MAX_REQUESTS_PER_DAY &&
      user.otpLastRequestedAt && user.otpLastRequestedAt > windowCutoff;
    return denyRequest(capped
      ? 'Daily OTP request limit (10 requests per 24 hours) has been reached. Please try again tomorrow.'
      : 'Please wait a minute before requesting another code.');
  }

  try {
    await sendEmail({
      to: user.email,
      subject: `CLEAR System: ${org.name} Verification Code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; background: #f8f9fa;">
          <div style="background: #ffffff; border-radius: 12px; padding: 30px; border: 1px solid #dee2e6;">
            <h2 style="margin-top: 0; color: #212529;">CLEAR System</h2>
            <p>Hello <strong>${sanitizeHTML(user.fullName)}</strong>,</p>
            <p>Your verification code for <strong>${sanitizeHTML(org.name)}</strong> is:</p>
            <div style="text-align: center; margin: 30px 0;">
              <div style="display: inline-block; padding: 15px 25px; font-size: 32px; font-weight: bold; letter-spacing: 8px; background: #f1f3f5; border-radius: 10px; color: #212529;">
                ${code}
              </div>
            </div>
            <p>This verification code will expire in <strong>5 minutes</strong>.</p>
          </div>
        </div>
      `,
      text: `Your CLEAR System verification code for ${org.name} is: ${code}`,
    });
  } catch (error) {
    console.error('Department OTP email failed:', error);
    await prisma.tenantUser.update({ where: { id: user.id }, data: { otpCode: null, otpExpires: null } });
    throw new Error('Unable to send verification email. Please try again.');
  }

  return { success: true as const, message: VERBOSE_ERRORS
    ? 'A verification code has been sent to your registered email address.'
    : GENERIC_SENT };
}

// ------------------------------------------------------------------ VERIFY
export async function verifyDepartmentOtp(department: string, email: string, code: string) {
  const e = norm(email);

  const org = await prisma.organization.findFirst({
    where: { subdomain: { equals: normDept(department), mode: 'insensitive' } },
    select: { id: true, subdomain: true, name: true, status: true },
  });
  if (!org) return denyVerify('Department not found.');

  const user = await prisma.tenantUser.findFirst({
    where: { organizationId: org.id, email: { equals: e, mode: 'insensitive' } },
  });
  if (!user) return denyVerify('This account is not authorized for this department.');
  if (user.status === 'Blocked') return denyVerify(BLOCKED_MSG);
  if (user.status !== 'Active') return denyVerify(INACTIVE_MSG);
  if (org.status && org.status !== 'Active') {
    return denyVerify(`This department is currently ${org.status.toLowerCase()} and cannot be accessed.`);
  }

  const now = new Date();
  if (await isTemporarilyLocked(user.id, now)) return denyVerify('Too many incorrect attempts. Please try again later.');
  if (!user.otpCode) return denyVerify('No department verification code requested.');
  if (!user.otpExpires || user.otpExpires < now) return denyVerify('Verification code has expired.');

  // Count the attempt FIRST, atomically, so parallel guesses cannot dodge the limit.
  const upd = await prisma.tenantUser.update({
    where: { id: user.id },
    data: { otpAttempts: { increment: 1 } },
    select: { otpAttempts: true },
  });
  const match = safeEqual(user.otpCode, hash(code));

  if (upd.otpAttempts > MAX_ATTEMPTS || (!match && upd.otpAttempts >= MAX_ATTEMPTS)) {
    await lockUser(user.id, now);
    return {
      ok: false as const,
      message: VERBOSE_ERRORS
        ? (BLOCK_MODE === 'permanent'
            ? 'Maximum failed attempts (5/5) reached. Your account is now BLOCKED. Only an Admin or Super Admin can unblock your account.'
            : 'Too many incorrect attempts. Please wait 30 minutes and request a new code.')
        : GENERIC_LOCKED,
    };
  }
  if (!match) {
    const remaining = MAX_ATTEMPTS - upd.otpAttempts;
    return denyVerify(`Invalid verification code. You have ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before your account is blocked.`);
  }

  // Single use, even if two correct submissions race.
  const consumed = await prisma.tenantUser.updateMany({
    where: { id: user.id, otpCode: user.otpCode },
    data: { otpCode: null, otpExpires: null, otpAttempts: 0 },
  });
  if (consumed.count !== 1) return denyVerify('Verification code has expired.');

  return { ok: true as const, user, org, allowedTabs: parseTabs(user.allowedTabs) };
}
