// Student-only OTP and short-lived clearance sessions.
// Uses namespaced VerificationToken and AuthThrottle rows rather than student,
// collection or tenant business tables. All business data access remains GET-only.
import 'server-only';
import crypto from 'node:crypto';
import type { Organization, Student } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/mailer';
import { ApiFailure } from '@/lib/mobile/http';

const OTP_TTL_MS = 5 * 60_000;
const SESSION_TTL_MS = 10 * 60_000;
const LOCK_MS = 30 * 60_000;
const WINDOW_MS = 60 * 60_000;
const MAX_GUESSES = 5;
const GENERIC_SENT = 'If the student ID and registered email match, a verification code has been sent.';
const GENERIC_INVALID = 'Invalid or expired verification code.';
const norm = (value: unknown) => String(value || '').trim().toLowerCase();

function secret() {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value || value.length < 32) throw new Error('CLEAR student authentication secret is not configured.');
  return value;
}
function digest(label: string, value: string) {
  return crypto.createHmac('sha256', secret()).update('mobile-student:' + label + ':' + value).digest('hex');
}
function fingerprint(orgId: string, schoolId: string, email: string) {
  return digest('identity', [orgId, norm(schoolId), norm(email)].join(':'));
}
function otpIdentifier(fingerprintValue: string) { return 'clear-student:otp:' + fingerprintValue; }
function guessKey(fingerprintValue: string) { return 'clear-student:guess:' + fingerprintValue; }
function sessionIdentifier(token: string) {
  return 'clear-student:session:' + crypto.createHash('sha256').update(token).digest('hex');
}
function sourceFingerprint(req: Request) {
  // Source is supplementary abuse protection, never an authentication factor.
  // The per-identity budgets below remain enforced even if proxy IP headers
  // are absent or spoofed.
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',').map(v => v.trim()).filter(Boolean).pop() || 'unknown';
  return digest('source', ip.slice(0, 120));
}
function validInputs(studentId: string, email: string) {
  return studentId.length > 0 && studentId.length <= 80 &&
    email.length > 3 && email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Transactionally consumes a fixed issuance budget with an optional cooldown. */
async function spendBudget(key: string, maximum: number, cooldown: number, now: Date) {
  await prisma.authThrottle.upsert({
    where: { key },
    create: { key, failedCount: 0, lastSentAt: now, updatedAt: new Date(0) },
    update: {},
  });
  await prisma.authThrottle.updateMany({
    where: { key, OR: [{ lastSentAt: null }, { lastSentAt: { lte: new Date(now.getTime() - WINDOW_MS) } }] },
    data: { failedCount: 0, lastSentAt: now, updatedAt: new Date(0) },
  });
  const updated = await prisma.authThrottle.updateMany({
    where: {
      key, failedCount: { lt: maximum },
      updatedAt: { lte: new Date(now.getTime() - cooldown) },
    },
    data: { failedCount: { increment: 1 }, updatedAt: now },
  });
  return updated.count === 1;
}

/** Only a matching student and registered email receive a message. Always reply generically. */
export async function requestStudentClearanceCode(
  org: Pick<Organization, 'id' | 'name'>,
  rawStudentId: string,
  rawEmail: string,
  req: Request
) {
  const studentId = String(rawStudentId || '').trim();
  const email = norm(rawEmail);
  if (!validInputs(studentId, email)) {
    throw new ApiFailure(400, 'invalid', 'Enter a valid school ID and registered email address.');
  }
  const now = new Date();
  const identity = fingerprint(org.id, studentId, email);
  // Both budgets apply regardless of whether the student exists. Store only
  // HMAC identifiers, never a plaintext email or school ID, in throttle keys.
  const sourceAllowed = await spendBudget('clear-student:send-source:' + sourceFingerprint(req), 30, 0, now);
  const accountAllowed = await spendBudget('clear-student:send-account:' + identity, 5, 60_000, now);
  if (!sourceAllowed || !accountAllowed) return { message: GENERIC_SENT };

  const student = await prisma.student.findFirst({
    where: {
      organizationId: org.id,
      studentId: { equals: studentId, mode: 'insensitive' },
      email: { equals: email, mode: 'insensitive' },
    },
    select: { id: true, email: true },
  });
  if (!student?.email) return { message: GENERIC_SENT };

  const code = crypto.randomInt(100000, 1000000).toString();
  const identifier = otpIdentifier(identity);
  const token = digest('otp', identity + ':' + code);
  await prisma.verificationToken.upsert({
    where: { identifier },
    create: { identifier, token, expires: new Date(now.getTime() + OTP_TTL_MS) },
    update: { token, expires: new Date(now.getTime() + OTP_TTL_MS) },
  });

  try {
    await sendEmail({
      to: student.email,
      subject: 'CLEAR System: Student Clearance Verification Code',
      html: '<div style="font-family:Arial,sans-serif;max-width:500px;padding:24px">' +
        '<h2>CLEAR Student Clearance</h2><p>Your verification code is:</p>' +
        '<p style="font-size:30px;letter-spacing:5px;font-weight:bold">' + code + '</p>' +
        '<p>This code expires in five minutes. If you did not request it, ignore this email.</p></div>',
      text: 'Your CLEAR clearance verification code is ' + code +
        '. It expires in five minutes. If you did not request it, ignore this email.',
    });
  } catch {
    // Suppress account-existence leaks from different SMTP outcomes.
    await prisma.verificationToken.deleteMany({ where: { identifier, token } });
    console.error('[student-clearance] code delivery unavailable');
  }
  return { message: GENERIC_SENT };
}

/** Every guess, even for nonexistent accounts, is subject to a durable account lock. */
async function spendGuess(key: string, now: Date) {
  await prisma.authThrottle.upsert({
    where: { key },
    create: { key, failedCount: 0, lastSentAt: now, updatedAt: new Date(0) },
    update: {},
  });
  await prisma.authThrottle.updateMany({
    where: {
      key, lastSentAt: { lte: new Date(now.getTime() - LOCK_MS) },
      OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
    },
    data: { failedCount: 0, lastSentAt: now, lockedUntil: null },
  });
  const admitted = await prisma.authThrottle.updateMany({
    where: {
      key, failedCount: { lt: MAX_GUESSES },
      OR: [{ lockedUntil: null }, { lockedUntil: { lte: now } }],
    },
    data: { failedCount: { increment: 1 }, updatedAt: now },
  });
  if (admitted.count !== 1) {
    throw new ApiFailure(429, 'rate_limited', 'Verification attempts are temporarily limited. Try again later.');
  }
  const row = await prisma.authThrottle.findUnique({ where: { key }, select: { failedCount: true } });
  return row?.failedCount ?? MAX_GUESSES;
}

/** Single-use verified email OTP becomes one revocable, random 10-minute session. */
export async function verifyStudentClearanceCode(
  org: Pick<Organization, 'id' | 'activeAy' | 'activeTerm'>,
  rawStudentId: string,
  rawEmail: string,
  rawCode: string,
  req: Request
) {
  const studentId = String(rawStudentId || '').trim();
  const email = norm(rawEmail);
  const code = String(rawCode || '').trim();
  if (!validInputs(studentId, email)) throw new ApiFailure(400, 'invalid_code', GENERIC_INVALID);
  const now = new Date();
  const identity = fingerprint(org.id, studentId, email);
  // Protect random-account floods as well as guesses at one account.
  if (!(await spendBudget('clear-student:verify-source:' + sourceFingerprint(req), 100, 0, now))) {
    throw new ApiFailure(429, 'rate_limited', 'Too many verification attempts. Try again later.');
  }
  const guesses = await spendGuess(guessKey(identity), now);
  const identifier = otpIdentifier(identity);
  const expected = digest('otp', identity + ':' + code);
  // Only exact six-digit values and unused, unexpired server-generated hashes count.
  const consumed = /^\d{6}$/.test(code) ? await prisma.verificationToken.deleteMany({
    where: { identifier, token: expected, expires: { gt: now } },
  }) : { count: 0 };
  if (consumed.count !== 1) {
    if (guesses >= MAX_GUESSES) {
      await prisma.authThrottle.updateMany({
        where: { key: guessKey(identity), failedCount: { gte: MAX_GUESSES } },
        data: { lockedUntil: new Date(now.getTime() + LOCK_MS) },
      });
      await prisma.verificationToken.deleteMany({ where: { identifier } });
    }
    throw new ApiFailure(400, 'invalid_code', GENERIC_INVALID);
  }

  // Always recheck the actual tenant roster after consuming the code.
  const student = await prisma.student.findFirst({
    where: {
      organizationId: org.id,
      studentId: { equals: studentId, mode: 'insensitive' },
      email: { equals: email, mode: 'insensitive' },
    },
    select: { id: true, email: true },
  });
  if (!student?.email) throw new ApiFailure(400, 'invalid_code', GENERIC_INVALID);
  const token = 'clrs_' + crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.verificationToken.create({
    data: {
      identifier: sessionIdentifier(token),
      token: JSON.stringify({
        orgId: org.id, studentId: student.id,
        emailHash: digest('email', norm(student.email)),
        ay: org.activeAy, term: org.activeTerm,
      }),
      expires: expiresAt,
    },
  });
  await prisma.authThrottle.updateMany({
    where: { key: guessKey(identity) },
    data: { failedCount: 0, lockedUntil: null, lastSentAt: new Date() },
  });
  return { token, expiresAt: expiresAt.toISOString() };
}

function readToken(req: Request) {
  const header = (req.headers.get('authorization') || '').trim();
  const match = /^Bearer\s+(clrs_[A-Za-z0-9_-]{35,120})$/.exec(header);
  if (!match) throw new ApiFailure(401, 'unauthorized', 'Verify your registered email to view clearance.');
  return match[1];
}
export async function requireStudentClearanceSession(
  req: Request,
  org: Pick<Organization, 'id' | 'activeAy' | 'activeTerm'>
): Promise<Pick<Student, 'id' | 'studentId'>> {
  const token = readToken(req);
  const row = await prisma.verificationToken.findUnique({
    where: { identifier: sessionIdentifier(token) },
  });
  if (!row || row.expires <= new Date()) {
    throw new ApiFailure(401, 'unauthorized', 'Clearance verification expired. Request a new code.');
  }
  let payload: unknown;
  try { payload = JSON.parse(row.token); } catch { /* Reject malformed session. */ }
  if (!payload || typeof payload !== 'object') throw new ApiFailure(401, 'unauthorized', 'Invalid clearance session.');
  const p = payload as Record<string, unknown>;
  if (p.orgId !== org.id || p.ay !== org.activeAy || p.term !== org.activeTerm || typeof p.studentId !== 'string') {
    throw new ApiFailure(401, 'unauthorized', 'Clearance session is not valid for this tenant or period.');
  }
  const student = await prisma.student.findFirst({
    where: { id: p.studentId, organizationId: org.id },
    select: { id: true, studentId: true, email: true },
  });
  if (!student?.email || p.emailHash !== digest('email', norm(student.email))) {
    throw new ApiFailure(401, 'unauthorized', 'Student authorization has changed. Verify again.');
  }
  return { id: student.id, studentId: student.studentId };
}

export async function revokeStudentClearanceSession(req: Request) {
  const token = readToken(req);
  await prisma.verificationToken.deleteMany({ where: { identifier: sessionIdentifier(token) } });
}
