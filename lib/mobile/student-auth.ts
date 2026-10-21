import 'server-only';
import crypto from 'node:crypto';
import type { Organization } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ApiFailure } from '@/lib/mobile/http';
import { sendEmail } from '@/lib/mailer';
import { isOrganizationActive } from '@/lib/roles';
import { getStudentClearance } from '@/lib/clearance';
import {
  STUDENT_GENERIC_INVALID, STUDENT_GENERIC_SENT, STUDENT_OTP_ATTEMPTS,
  STUDENT_OTP_TTL_MS, STUDENT_SESSION_TTL_MS,
  studentDigest, studentIdentityEnabled, studentSecret, trustedStudentRequestSource, validStudentEmail,
} from '@/lib/mobile/student-policy';

type StudentOrg = Pick<Organization, 'id' | 'name' | 'subdomain' | 'activeAy' | 'activeTerm' | 'status'>;
const INVALID = () => new ApiFailure(400, 'invalid_code', STUDENT_GENERIC_INVALID);
const DISABLED = () => new ApiFailure(503, 'unavailable', 'Student verification is not available yet.');
const LIMIT = () => new ApiFailure(429, 'rate_limited', 'Too many verification requests. Please try again later.');

function verifiedIngress(req: Request) {
  if (!studentIdentityEnabled()) throw DISABLED();
  const source = trustedStudentRequestSource(req, { vercel: process.env.VERCEL, environment: process.env.VERCEL_ENV });
  if (!source) throw DISABLED(); // fail closed on unknown/spoofable ingress
  return source;
}

/** One atomic budget admission per key, durable across serverless instances. */
async function claimBudget(key: string, now: Date, durationMs: number, max: number) {
  await prisma.studentAuthBudget.upsert({
    where: { key }, create: { key, windowStart: now, used: 0 }, update: {},
  });
  await prisma.studentAuthBudget.updateMany({
    where: { key, windowStart: { lte: new Date(now.getTime() - durationMs) } },
    data: { windowStart: now, used: 0 },
  });
  const admitted = await prisma.studentAuthBudget.updateMany({
    where: { key, used: { lt: max } }, data: { used: { increment: 1 } },
  });
  if (admitted.count !== 1) throw LIMIT();
}

async function enforceBudgets(req: Request, organizationId: string, email: string, action: 'request' | 'verify') {
  const source = verifiedIngress(req);
  const secret = studentSecret();
  const sourceKey = studentDigest('source', source, secret);
  const accountKey = studentDigest('account', organizationId + ':' + email, secret);
  const now = new Date();
  // No plaintext email or IP appears in throttle records.
  const limits: Array<[string, number, number]> = action === 'request'
    ? [
      [`student:send:minute:${accountKey}`, 60_000, 1],
      [`student:send:hour:${accountKey}`, 3_600_000, 3],
      [`student:send:day:${accountKey}`, 86_400_000, 10],
      [`student:send:source-hour:${sourceKey}`, 3_600_000, 20],
      [`student:send:source-day:${sourceKey}`, 86_400_000, 100],
    ]
    : [
      [`student:guess:hour:${accountKey}`, 3_600_000, 12],
      [`student:guess:source-hour:${sourceKey}`, 3_600_000, 30],
    ];
  // All claims are charged even if a later budget rejects the attempt.
  // Database failures deny admission instead of opening an in-memory fallback.
  for (const [key, duration, max] of limits) await claimBudget(key, now, duration, max);
}

async function lookupUniqueRegisteredStudent(orgId: string, email: string) {
  const students = await prisma.student.findMany({
    where: { organizationId: orgId, email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true }, take: 2,
  });
  // Ambiguous shared email accounts are deliberately refused.
  return students.length === 1 && validStudentEmail(students[0].email) === email ? students[0] : null;
}

export async function requestStudentCode(req: Request, org: StudentOrg, email: string) {
  verifiedIngress(req);
  await enforceBudgets(req, org.id, email, 'request');
  if (!isOrganizationActive(org)) return { message: STUDENT_GENERIC_SENT };
  const student = await lookupUniqueRegisteredStudent(org.id, email);
  if (!student?.email) return { message: STUDENT_GENERIC_SENT };
  const now = new Date();
  const code = crypto.randomInt(100000, 1_000_000).toString();
  const hash = studentDigest('otp:' + student.id, code, studentSecret());
  await prisma.studentOtpChallenge.upsert({
    where: { studentId: student.id },
    create: { organizationId: org.id, studentId: student.id, codeHash: hash,
      expiresAt: new Date(now.getTime() + STUDENT_OTP_TTL_MS) },
    update: { organizationId: org.id, codeHash: hash, attempts: 0,
      expiresAt: new Date(now.getTime() + STUDENT_OTP_TTL_MS), createdAt: now },
  });
  try {
    await sendEmail({
      to: student.email, subject: 'CLEAR System — student clearance verification',
      text: `Your CLEAR student clearance verification code for ${org.name} is ${code}. This code expires in 5 minutes. If you did not request it, ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;padding:24px"><h2>CLEAR System</h2><p>Student clearance sign-in code:</p><p style="font-size:28px;letter-spacing:5px">${code}</p><p>Expires in 5 minutes. Do not share this code.</p></div>`,
    });
  } catch {
    // Clear only the failed delivery, never a concurrently renewed code.
    await prisma.studentOtpChallenge.deleteMany({ where: { studentId: student.id, codeHash: hash } });
    // Non-enumerating reply, no email address/provider details in server logs.
  }
  return { message: STUDENT_GENERIC_SENT };
}

export async function verifyStudentCode(req: Request, org: StudentOrg, email: string, code: string) {
  verifiedIngress(req);
  await enforceBudgets(req, org.id, email, 'verify');
  if (!isOrganizationActive(org) || !/^\d{6}$/.test(code)) throw INVALID();
  const student = await lookupUniqueRegisteredStudent(org.id, email);
  if (!student) throw INVALID();
  const challenge = await prisma.studentOtpChallenge.findUnique({ where: { studentId: student.id } });
  const now = new Date();
  if (!challenge || challenge.organizationId !== org.id || challenge.expiresAt <= now) throw INVALID();
  const admitted = await prisma.studentOtpChallenge.updateMany({
    where: { studentId: student.id, codeHash: challenge.codeHash,
      expiresAt: { gt: now }, attempts: { lt: STUDENT_OTP_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (admitted.count !== 1) throw INVALID();
  const expected = Buffer.from(studentDigest('otp:' + student.id, code, studentSecret()), 'hex');
  const actual = Buffer.from(challenge.codeHash, 'hex');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    // Lock challenge after five guesses; no account existence disclosed.
    await prisma.studentOtpChallenge.deleteMany({
      where: { studentId: student.id, codeHash: challenge.codeHash, attempts: { gte: STUDENT_OTP_ATTEMPTS } },
    });
    throw INVALID();
  }
  const consumed = await prisma.studentOtpChallenge.deleteMany({
    where: { studentId: student.id, organizationId: org.id, codeHash: challenge.codeHash,
      expiresAt: { gt: now }, attempts: { lte: STUDENT_OTP_ATTEMPTS } },
  });
  if (consumed.count !== 1) throw INVALID();
  const token = 'clrs_' + crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + STUDENT_SESSION_TTL_MS);
  await prisma.studentReadSession.create({
    data: { organizationId: org.id, studentId: student.id,
      tokenHash: studentDigest('session', token, studentSecret()),
      academicYear: org.activeAy, term: org.activeTerm, expiresAt },
  });
  return { token, expiresAt: expiresAt.toISOString() };
}

export async function getOwnStudentClearance(req: Request, org: StudentOrg) {
  verifiedIngress(req);
  const bearer = req.headers.get('authorization') || '';
  const token = /^Bearer (clrs_[A-Za-z0-9_-]{40,60})$/.exec(bearer)?.[1];
  if (!token) throw new ApiFailure(401, 'unauthorized', 'Sign in again to check clearance.');
  const session = await prisma.studentReadSession.findUnique({
    where: { tokenHash: studentDigest('session', token, studentSecret()) },
    include: { student: true },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date() ||
      session.organizationId !== org.id || session.student.organizationId !== org.id ||
      !session.student.email || !isOrganizationActive(org) ||
      session.academicYear !== org.activeAy || session.term !== org.activeTerm) {
    throw new ApiFailure(401, 'unauthorized', 'Sign in again to check clearance.');
  }
  // Identity comes exclusively from the bound session, NEVER from a query string.
  const result = await getStudentClearance(org.id, session.student.studentId, org.activeAy, org.activeTerm);
  if (!result || result.student.id !== session.student.id) {
    throw new ApiFailure(409, 'unavailable', 'Clearance cannot be confirmed at this time.');
  }
  return { status: result.isCleared ? 'cleared' : 'hold', ay: org.activeAy, term: org.activeTerm,
    // Legacy verification URLs contain a school ID. Do not disclose them in private self-service.
    qrToken: null, mode: 'student_private' as const };
}

export async function revokeStudentSession(req: Request, org: StudentOrg) {
  verifiedIngress(req);
  const token = /^Bearer (clrs_[A-Za-z0-9_-]{40,60})$/.exec(req.headers.get('authorization') || '')?.[1];
  if (!token) return { success: true };
  await prisma.studentReadSession.updateMany({
    where: { tokenHash: studentDigest('session', token, studentSecret()), organizationId: org.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return { success: true };
}
