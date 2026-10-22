// Verified email rotation for CLEAR tenant officers and student roster records.
// This module never changes financial records, receipts, permissions, or enrollments.
import 'server-only';
import crypto from 'node:crypto';
import { isIP } from 'node:net';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/mailer';
import { ApiFailure } from '@/lib/mobile/http';
import { isReservedGlobalAdminEmail } from '@/lib/super-admin';

type Actor = 'officer' | 'student';
type Scope = {
  actor: Actor;
  orgId: string;
  accountId: string;
  currentEmail: string;
  // Officer: mobile session ID; student: temporary registered-email OTP session.
  sessionKey: string;
};
const OTP_MS = 5 * 60_000;
const VERIFIED_MS = 10 * 60_000;
const COOLDOWN_MS = 60_000;
const WINDOW_MS = 60 * 60_000;
const LOCK_MS = 30 * 60_000;
const MAX_GUESSES = 5;
const SENT = 'If this request is eligible, a verification code has been sent.';
const INVALID = 'The verification code is invalid or expired. Please restart verification.';
const norm = (value: unknown) => String(value ?? '').trim().toLowerCase();
const validEmail = (email: string) => email.length > 3 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

function secret() {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value || value.length < 32) throw new Error('CLEAR identity secret is not configured.');
  return value;
}
function digest(label: string, value: string) {
  return crypto.createHmac('sha256', secret()).update('clear-email-rotation:' + label + ':' + value).digest('hex');
}
function basis(scope: Scope) {
  return digest('scope', [scope.actor, scope.orgId, scope.accountId, norm(scope.currentEmail), scope.sessionKey].join('|'));
}
function identifier(scope: Scope, phase: 'current' | 'new', target = '') {
  return 'clear-email-rotation:otp:' + digest(phase, basis(scope) + ':' + norm(target));
}
function marker(scope: Scope) { return 'clear-email-rotation:verified:' + basis(scope); }
function sourceHash(req: Request) {
  const raw = process.env.VERCEL === '1' ? req.headers.get('x-vercel-forwarded-for') : null;
  const candidate = raw && !raw.includes(',') ? raw.trim() : '';
  return digest('source', isIP(candidate) ? candidate : 'unknown');
}
function throttleKey(label: string, scope: Scope, target = '') {
  return 'clear-email-rotation:' + label + ':' + digest('throttle', basis(scope) + ':' + norm(target));
}
async function consumeBudget(key: string, max: number, cooldown: number, now: Date) {
  await prisma.authThrottle.upsert({
    where: { key },
    create: { key, failedCount: 0, lastSentAt: now, updatedAt: new Date(0) },
    update: {},
  });
  await prisma.authThrottle.updateMany({
    where: { key, OR: [{ lastSentAt: null }, { lastSentAt: { lte: new Date(now.getTime() - WINDOW_MS) } }] },
    data: { failedCount: 0, lastSentAt: now, updatedAt: new Date(0) },
  });
  const result = await prisma.authThrottle.updateMany({
    where: {
      key, failedCount: { lt: max },
      updatedAt: { lte: new Date(now.getTime() - cooldown) },
      OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
    },
    data: { failedCount: { increment: 1 }, updatedAt: now },
  });
  return result.count === 1;
}
async function admitSend(scope: Scope, phase: string, target: string, req: Request) {
  const now = new Date();
  const source = await consumeBudget('clear-email-rotation:source:' + sourceHash(req), 30, 0, now);
  const account = await consumeBudget(throttleKey('send:' + phase, scope, target), 5, COOLDOWN_MS, now);
  return source && account;
}
async function spendGuess(scope: Scope, phase: string, target: string, req: Request) {
  const now = new Date();
  const allowedSource = await consumeBudget('clear-email-rotation:verify:' + sourceHash(req), 100, 0, now);
  const allowedAccount = await consumeBudget(throttleKey('guess:' + phase, scope, target), MAX_GUESSES, 0, now);
  if (!allowedSource || !allowedAccount) throw new ApiFailure(429, 'rate_limited', 'Too many attempts. Please try again later.');
}
async function createCode(scope: Scope, phase: 'current' | 'new', target: string) {
  const code = crypto.randomInt(100000, 1000000).toString();
  const id = identifier(scope, phase, phase === 'new' ? target : '');
  const token = digest('code', id + ':' + code);
  const expires = new Date(Date.now() + OTP_MS);
  await prisma.verificationToken.upsert({
    where: { identifier: id },
    create: { identifier: id, token, expires },
    update: { token, expires },
  });
  try {
    await sendEmail({
      to: target,
      subject: 'CLEAR System: Verify account email change',
      text: 'Your CLEAR email change verification code is ' + code + '. It expires in five minutes. If you did not request this, contact your department administrator.',
      html: '<div style="font-family:Arial,sans-serif;max-width:500px;padding:24px"><h2>CLEAR System</h2><p>Your email change verification code is:</p><p style="font-size:30px;letter-spacing:5px;font-weight:bold">' + code + '</p><p>This code expires in five minutes. If you did not request it, contact your department administrator.</p></div>',
    });
  } catch {
    await prisma.verificationToken.deleteMany({ where: { identifier: id, token } });
    console.error('[email-rotation] message delivery failed');
  }
}

async function consumeCode(scope: Scope, phase: 'current' | 'new', target: string, code: string) {
  const id = identifier(scope, phase, phase === 'new' ? target : '');
  if (!/^\d{6}$/.test(code)) throw new ApiFailure(400, 'invalid_code', INVALID);
  const token = digest('code', id + ':' + code);
  const consumed = await prisma.verificationToken.deleteMany({
    where: { identifier: id, token, expires: { gt: new Date() } },
  });
  if (consumed.count !== 1) throw new ApiFailure(400, 'invalid_code', INVALID);
}

async function assertCurrentEmail(scope: Scope) {
  if (scope.actor === 'student') {
    const row = await prisma.student.findFirst({
      where: { id: scope.accountId, organizationId: scope.orgId, email: { equals: norm(scope.currentEmail), mode: 'insensitive' } },
      select: { id: true },
    });
    if (!row) throw new ApiFailure(401, 'unauthorized', 'Your student record has changed. Restart verification.');
  } else {
    const row = await prisma.tenantUser.findFirst({
      where: { id: scope.accountId, organizationId: scope.orgId, email: { equals: norm(scope.currentEmail), mode: 'insensitive' }, status: 'Active' },
      select: { id: true },
    });
    if (!row) throw new ApiFailure(401, 'unauthorized', 'Your officer profile has changed. Sign in again.');
  }
}

async function requireCurrentVerified(scope: Scope) {
  if (scope.actor === 'student') return; // requireStudentClearanceSession verified current email and rechecks it each request.
  const exists = await prisma.verificationToken.findFirst({
    where: { identifier: marker(scope), token: digest('approved', basis(scope)), expires: { gt: new Date() } },
    select: { identifier: true },
  });
  if (!exists) throw new ApiFailure(401, 'unauthorized', 'Verify a code sent to your current officer email first.');
}

/** An officer must freshly verify their registered address; the student already has an independently verified OTP session. */
export async function requestCurrentOfficerCode(scope: Scope, req: Request) {
  if (scope.actor !== 'officer') throw new ApiFailure(403, 'forbidden', 'Not available.');
  await assertCurrentEmail(scope);
  if (await admitSend(scope, 'current', '', req)) await createCode(scope, 'current', norm(scope.currentEmail));
  return { message: SENT };
}
export async function verifyCurrentOfficerCode(scope: Scope, input: string, req: Request) {
  if (scope.actor !== 'officer') throw new ApiFailure(403, 'forbidden', 'Not available.');
  await assertCurrentEmail(scope);
  await spendGuess(scope, 'current', '', req);
  await consumeCode(scope, 'current', '', input);
  await prisma.verificationToken.upsert({
    where: { identifier: marker(scope) },
    create: { identifier: marker(scope), token: digest('approved', basis(scope)), expires: new Date(Date.now() + VERIFIED_MS) },
    update: { token: digest('approved', basis(scope)), expires: new Date(Date.now() + VERIFIED_MS) },
  });
  return { verified: true };
}

export async function requestNewEmailCode(scope: Scope, proposed: string, req: Request) {
  const newEmail = norm(proposed);
  if (!validEmail(newEmail) || newEmail === norm(scope.currentEmail)) {
    throw new ApiFailure(400, 'invalid', 'Provide a different valid new email address.');
  }
  await assertCurrentEmail(scope);
  await requireCurrentVerified(scope);
  // Do not turn the request endpoint into a roster/account enumeration oracle.
  const eligibility = scope.actor === 'student'
    ? !(await prisma.student.findFirst({
      where: { organizationId: scope.orgId, id: { not: scope.accountId }, email: { equals: newEmail, mode: 'insensitive' } },
      select: { id: true },
    }))
    : !(await prisma.tenantUser.findFirst({
      where: { organizationId: scope.orgId, id: { not: scope.accountId }, email: { equals: newEmail, mode: 'insensitive' } },
      select: { id: true },
    })) && !(await isReservedGlobalAdminEmail(newEmail));
  if (await admitSend(scope, 'new', newEmail, req) && eligibility) {
    await createCode(scope, 'new', newEmail);
  }
  return { message: SENT };
}

/** One-use OTP is consumed in the same serializable transaction that updates the verified account. */
export async function confirmNewEmail(scope: Scope, proposed: string, rawCode: string, req: Request) {
  const newEmail = norm(proposed);
  if (!validEmail(newEmail) || newEmail === norm(scope.currentEmail)) throw new ApiFailure(400, 'invalid', 'Invalid new email address.');
  await assertCurrentEmail(scope);
  await requireCurrentVerified(scope);
  await spendGuess(scope, 'new', newEmail, req);
  if (!/^\d{6}$/.test(rawCode)) throw new ApiFailure(400, 'invalid_code', INVALID);
  if (scope.actor === 'officer' && await isReservedGlobalAdminEmail(newEmail)) throw new ApiFailure(400, 'invalid_code', INVALID);
  const otpId = identifier(scope, 'new', newEmail);
  const otpToken = digest('code', otpId + ':' + rawCode);
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.verificationToken.deleteMany({
      where: { identifier: otpId, token: otpToken, expires: { gt: new Date() } },
    });
    if (consumed.count !== 1) throw new ApiFailure(400, 'invalid_code', INVALID);
    if (scope.actor === 'student') {
      const existing = await tx.student.findFirst({
        where: { organizationId: scope.orgId, id: { not: scope.accountId }, email: { equals: newEmail, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) throw new ApiFailure(409, 'conflict', 'This email is already associated with a roster record. Contact your administrator.');
      const updated = await tx.student.updateMany({
        where: { id: scope.accountId, organizationId: scope.orgId, email: { equals: norm(scope.currentEmail), mode: 'insensitive' } },
        data: { email: newEmail },
      });
      if (updated.count !== 1) throw new ApiFailure(409, 'conflict', 'Your roster email changed. Please restart verification.');
    } else {
      const existing = await tx.tenantUser.findFirst({
        where: { organizationId: scope.orgId, id: { not: scope.accountId }, email: { equals: newEmail, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existing) throw new ApiFailure(409, 'conflict', 'This email is already used by another officer.');
      const updated = await tx.tenantUser.updateMany({
        where: { id: scope.accountId, organizationId: scope.orgId, status: 'Active', email: { equals: norm(scope.currentEmail), mode: 'insensitive' } },
        data: { email: newEmail, otpCode: null, otpExpires: null },
      });
      if (updated.count !== 1) throw new ApiFailure(409, 'conflict', 'Your profile changed. Please sign in again.');
      await tx.mobileSession.updateMany({ where: { tenantUserId: scope.accountId, organizationId: scope.orgId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.verificationToken.deleteMany({ where: { identifier: marker(scope) } });
    }
    await tx.systemLog.create({
      data: {
        organizationId: scope.orgId,
        user: scope.actor === 'student' ? 'Verified student self-service' : 'Verified officer self-service',
        action: scope.actor === 'student' ? 'STUDENT_SELF_EMAIL_CHANGE' : 'OFFICER_SELF_EMAIL_CHANGE',
        // Stable internal ID for authorized audit, no OTP, bearer token, or raw emails.
        details: 'Verified two-address email change for ' + scope.actor + ' record ' + scope.accountId,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
  return { success: true, message: 'Email updated. Please sign in or verify again using the new address.' };
}
