// Pure policy utilities for the student-only viewer. Never log raw source IPs,
// email addresses, OTP codes or bearer credentials.
import crypto from 'node:crypto';
import { isIP } from 'node:net';

export const STUDENT_OTP_TTL_MS = 5 * 60_000;
export const STUDENT_SESSION_TTL_MS = 10 * 60_000;
export const STUDENT_OTP_ATTEMPTS = 5;
export const STUDENT_GENERIC_SENT = 'If an eligible student has this registered email, a verification code has been sent.';
export const STUDENT_GENERIC_INVALID = 'Invalid or expired verification code.';

export function studentIdentityEnabled() {
  // Must stay OFF until migrations, verified SMTP and approved production rollout.
  return process.env.STUDENT_CLEARANCE_PRIVATE_ENABLED === 'true';
}

export function studentSecret() {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value || value.length < 32) throw new Error('Student authentication secret is unavailable.');
  return value;
}

export function studentDigest(kind: string, value: string, secret: string) {
  return crypto.createHmac('sha256', secret).update('clear-student-v1:' + kind + ':' + value).digest('hex');
}

export function validStudentEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

export function trustedStudentRequestSource(req: Request, deployment: { vercel?: string; environment?: string }) {
  // Vercel overwrites inbound forwarded IPs. Never parse caller-supplied
  // X-Forwarded-For on development/self-hosted deployments or trust multiple hops.
  if (deployment.vercel !== '1' || !['production', 'preview'].includes(deployment.environment || '')) {
    return null;
  }
  const address = req.headers.get('x-vercel-forwarded-for') || '';
  if (!address || address.includes(',') || !isIP(address)) return null;
  return address;
}
