/** Authenticated-encrypted short-lived certificates. No public student ID in links. */
import crypto from 'node:crypto';
const AAD = Buffer.from('CLEAR-CERTIFICATE-V3');
export const CERTIFICATE_VALIDITY_MS = 7 * 24 * 60 * 60 * 1000;
export type CertificateClaims = { orgId: string; studentPk: string; studentId: string; ay: string; term: string; issuedAt: number; expiresAt: number };
type IssueClaims = Pick<CertificateClaims,'orgId'|'studentPk'|'studentId'|'ay'|'term'>;
function secretKey(): Buffer {
  const secret = process.env.CLEARANCE_SALT || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.length < 24) throw new Error('CLEAR certificate secret is unavailable.');
  return crypto.createHash('sha256').update('CLEAR:certificate:v3:').update(secret).digest();
}
export function issueClearanceCertificate(claims: IssueClaims, now = Date.now()): string {
  if (!Number.isSafeInteger(now) || Object.values(claims).some(v => !v || v.length > 120))
    throw new Error('Invalid clearance claims.');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secretKey(), iv);
  cipher.setAAD(AAD);
  const body = Buffer.concat([cipher.update(JSON.stringify({
    ...claims, issuedAt: now, expiresAt: now + CERTIFICATE_VALIDITY_MS,
  }), 'utf8'), cipher.final()]);
  return 'v3.' + Buffer.concat([iv,body,cipher.getAuthTag()]).toString('base64url');
}
export function readClearanceCertificate(token: string, now = Date.now()): CertificateClaims | null {
  if (!/^v3\.[a-zA-Z0-9_-]{60,900}$/.test(token) || !Number.isSafeInteger(now)) return null;
  try {
    const value = Buffer.from(token.slice(3),'base64url');
    if (value.length < 29 || value.length > 650) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', secretKey(), value.subarray(0,12));
    decipher.setAAD(AAD); decipher.setAuthTag(value.subarray(-16));
    const raw: unknown = JSON.parse(Buffer.concat([
      decipher.update(value.subarray(12,-16)), decipher.final(),
    ]).toString('utf8'));
    if (!raw || typeof raw !== 'object') return null;
    const c = raw as Partial<CertificateClaims>;
    for (const field of ['orgId','studentPk','studentId','ay','term'] as const) {
      if (typeof c[field] !== 'string' || c[field]!.length < 1 || c[field]!.length > 120) return null;
    }
    if (!Number.isSafeInteger(c.issuedAt) || !Number.isSafeInteger(c.expiresAt) ||
        c.issuedAt! > now + 60000 || c.expiresAt! <= now ||
        c.expiresAt! - c.issuedAt! !== CERTIFICATE_VALIDITY_MS) return null;
    return c as CertificateClaims;
  } catch { return null; }
}
