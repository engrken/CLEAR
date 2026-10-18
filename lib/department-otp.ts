import 'server-only';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/mailer';
import { sanitizeHTML } from '@/lib/utils';
import { isSuperAdminEmail } from '@/lib/super-admin';
import { issueSuperAdminOtp } from '@/lib/super-admin-otp';
import { parseAllowedTabs } from '@/lib/role-permissions';

const TTL_MS = 5 * 60 * 1000;
const COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_DAILY_SENDS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
const LOCK_MS = 30 * 60 * 1000;
const GENERIC_SENT = 'If the account is registered and active, a verification code has been sent.';
const GENERIC_FAILURE = 'Invalid or expired verification code.';
const TOO_MANY = 'Too many incorrect attempts. Please try again later.';
const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

function slug(v: unknown) {
  let value: string;
  try { value = decodeURIComponent(String(v ?? '')).toLowerCase().trim(); }
  catch { return ''; }
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value) ? value : '';
}

function secret() {
  const key = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!key || key.length < 32) throw new Error('OTP signing secret must be configured with at least 32 characters.');
  return key;
}

function digest(code: string, userId: string) {
  return crypto.createHmac('sha256', secret()).update(`dept-otp:${userId}:${code}`).digest('hex');
}

const lockKey = (userId: string) => `dept-otp-lock:${userId}`;
const sendKey = (userId: string) => `dept-otp-send:${userId}`;

async function isLocked(userId: string, now: Date) {
  const throttle = await prisma.authThrottle.findUnique({ where: { key: lockKey(userId) } });
  return Boolean(throttle?.lockedUntil && throttle.lockedUntil > now);
}

async function lockCode(userId: string, codeHash: string, now: Date) {
  // Never lock a session after a newer code was issued or an older code consumed.
  const cleared = await prisma.tenantUser.updateMany({
    where: { id: userId, otpCode: codeHash },
    data: { otpCode: null, otpExpires: null, otpAttempts: 0 },
  });
  if (cleared.count !== 1) return;
  await prisma.authThrottle.upsert({
    where: { key: lockKey(userId) },
    create: { key: lockKey(userId), failedCount: MAX_ATTEMPTS,
      lockedUntil: new Date(now.getTime() + LOCK_MS), updatedAt: now },
    update: { failedCount: MAX_ATTEMPTS,
      lockedUntil: new Date(now.getTime() + LOCK_MS), updatedAt: now },
  });
}

/** Backward-compatible export. */
export const parseTabs = parseAllowedTabs;

export async function issueDepartmentOtp(department: string, email: string) {
  const normalizedEmail = norm(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw new Error('A valid email address is required.');
  }
  if (isSuperAdminEmail(normalizedEmail)) return issueSuperAdminOtp(normalizedEmail);

  const departmentSlug = slug(department);
  if (!departmentSlug) return { success: true as const, message: GENERIC_SENT };
  const org = await prisma.organization.findUnique({
    where: { subdomain: departmentSlug },
    select: { id: true, name: true, status: true },
  });
  if (!org || org.status !== 'Active') return { success: true as const, message: GENERIC_SENT };
  const user = await prisma.tenantUser.findFirst({
    where: { organizationId: org.id, email: { equals: normalizedEmail, mode: 'insensitive' }, status: 'Active' },
  });
  if (!user) return { success: true as const, message: GENERIC_SENT };
  const now = new Date();
  if (await isLocked(user.id, now)) return { success: true as const, message: GENERIC_SENT };

  // otpLastRequestedAt stores the START of the rolling 24-hour send budget.
  // The expiry timestamp of the previous code enforces the per-email cooldown.
  const oldWindowCutoff = new Date(now.getTime() - DAY_MS);
  await prisma.tenantUser.updateMany({
    where: { id: user.id, OR: [{ otpLastRequestedAt: null }, { otpLastRequestedAt: { lte: oldWindowCutoff } }] },
    data: { otpRequestCount: 0, otpLastRequestedAt: now },
  });
  // Preserve a 60-second cooldown even after the previous OTP was consumed.
  await prisma.authThrottle.upsert({
    where: { key: sendKey(user.id) },
    create: { key: sendKey(user.id), failedCount: 0, updatedAt: new Date(0) },
    update: {},
  });
  const throttle = await prisma.authThrottle.updateMany({
    where: { key: sendKey(user.id), updatedAt: { lte: new Date(now.getTime() - COOLDOWN_MS) } },
    data: { updatedAt: now },
  });
  if (!throttle.count) return { success: true as const, message: GENERIC_SENT };
  const code = crypto.randomInt(100000, 1000000).toString();
  const codeHash = digest(code, user.id);
  const admitted = await prisma.tenantUser.updateMany({
    where: {
      id: user.id, status: 'Active', otpRequestCount: { lt: MAX_DAILY_SENDS },
      OR: [{ otpExpires: null }, { otpExpires: { lte: new Date(now.getTime() + TTL_MS - COOLDOWN_MS) } }],
    },
    data: {
      otpCode: codeHash, otpExpires: new Date(now.getTime() + TTL_MS),
      otpAttempts: 0, otpRequestCount: { increment: 1 },
    },
  });
  if (admitted.count !== 1) return { success: true as const, message: GENERIC_SENT };

  try {
    await sendEmail({
      to: user.email,
      subject: `CLEAR System: ${org.name} Verification Code`,
      html: `<div style="font-family:Arial,sans-serif;max-width:500px;padding:24px">
        <h2>CLEAR System</h2><p>Hello ${sanitizeHTML(user.fullName)},</p>
        <p>Your verification code for ${sanitizeHTML(org.name)} is:</p>
        <p style="font-size:32px;letter-spacing:6px;font-weight:bold">${code}</p>
        <p>This code expires in five minutes.</p></div>`,
      text: `Your CLEAR System verification code for ${org.name} is ${code}. It expires in five minutes.`,
    });
  } catch (error) {
    console.error('Department OTP delivery failed:', error);
    // Clear ONLY the failed send's code; don't wipe a newer resend.
    await prisma.tenantUser.updateMany({
      where: { id: user.id, otpCode: codeHash },
      data: { otpCode: null, otpExpires: null },
    });
    throw new Error('Verification email could not be delivered. Please retry later.');
  }
  return { success: true as const, message: GENERIC_SENT };
}

export async function verifyDepartmentOtp(department: string, email: string, code: string) {
  const fail = { ok: false as const, message: GENERIC_FAILURE };
  const departmentSlug = slug(department);
  if (!departmentSlug || !/^\d{6}$/.test(code)) return fail;
  const org = await prisma.organization.findUnique({
    where: { subdomain: departmentSlug },
    select: { id: true, subdomain: true, name: true, status: true },
  });
  if (!org || org.status !== 'Active') return fail;
  const user = await prisma.tenantUser.findFirst({
    where: { organizationId: org.id, email: { equals: norm(email), mode: 'insensitive' }, status: 'Active' },
  });
  if (!user?.otpCode || !user.otpExpires) return fail;
  const now = new Date();
  if (user.otpExpires <= now || await isLocked(user.id, now)) return fail;
  const codeHash = user.otpCode;
  // The condition on otpCode and attempts makes admission safe under concurrent guesses.
  const admitted = await prisma.tenantUser.updateMany({
    where: { id: user.id, organizationId: org.id, status: 'Active', otpCode: codeHash,
      otpExpires: { gt: now }, otpAttempts: { lt: MAX_ATTEMPTS } },
    data: { otpAttempts: { increment: 1 } },
  });
  if (admitted.count !== 1) return fail;
  const current = await prisma.tenantUser.findUnique({
    where: { id: user.id }, select: { otpAttempts: true },
  });
  if (!current) return fail;
  const expected = Buffer.from(digest(code, user.id), 'hex');
  const supplied = Buffer.from(codeHash, 'hex');
  const matched = supplied.length === expected.length && crypto.timingSafeEqual(expected, supplied);
  if (!matched) {
    if (current.otpAttempts >= MAX_ATTEMPTS) await lockCode(user.id, codeHash, now);
    return { ok: false as const, message: current.otpAttempts >= MAX_ATTEMPTS ? TOO_MANY : GENERIC_FAILURE };
  }
  // Successfully consume only ONE pending code, even with simultaneous correct requests.
  const consumed = await prisma.tenantUser.updateMany({
    where: { id: user.id, otpCode: codeHash, otpExpires: { gt: now }, status: 'Active' },
    data: { otpCode: null, otpExpires: null, otpAttempts: 0 },
  });
  if (consumed.count !== 1) return fail;
  return { ok: true as const, user, org, allowedTabs: parseTabs(user.allowedTabs) };
}
