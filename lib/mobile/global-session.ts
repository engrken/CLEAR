// Global administrator mobile sessions, deliberately isolated from tenant officers.
// Never infer global privileges from a MobileSession or a client-supplied role.
import 'server-only';
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { ApiFailure } from '@/lib/mobile/http';
import { verifyGlobalAdminSession, type GlobalIdentity } from '@/lib/super-admin';

const SIX_HOURS = 6 * 60 * 60 * 1000;
const SESSION_ENDED = 'Your global administrator session has ended. Sign in again.';
const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

function bearerToken(req: Request) {
  const match = /^Bearer\\s+(clrg_[A-Za-z0-9_-]{30,160})$/.exec(
    (req.headers.get('authorization') || '').trim()
  );
  return match?.[1] ?? null;
}

export async function createGlobalMobileSession(identity: GlobalIdentity, agent: string | null) {
  // Only identities already verified using the canonical web OTP can reach here.
  const token = 'clrg_' + crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SIX_HOURS);
  await prisma.globalMobileSession.create({
    data: {
      tokenHash: hashToken(token),
      adminEmail: identity.email,
      globalAdminId: identity.id,
      globalAdminVersion: identity.sessionVersion,
      expiresAt,
      userAgent: agent?.slice(0, 200) ?? null,
    },
  });
  return { token, expiresAt };
}

export async function requireGlobalMobileAdmin(req: Request) {
  const token = bearerToken(req);
  if (!token) throw new ApiFailure(401, 'unauthorized', SESSION_ENDED);
  const record = await prisma.globalMobileSession.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.revokedAt || record.expiresAt <= new Date()) {
    throw new ApiFailure(401, 'unauthorized', SESSION_ENDED);
  }
  const identity = await verifyGlobalAdminSession({
    email: record.adminEmail,
    role: 'SuperAdmin',
    globalAdminId: record.globalAdminId,
    globalAdminVersion: record.globalAdminVersion,
  });
  if (!identity) {
    await prisma.globalMobileSession.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new ApiFailure(401, 'unauthorized', SESSION_ENDED);
  }
  // This is not a tenant officer token: no tenant organization access is implied.
  if (Date.now() - record.lastUsedAt.getTime() > 5 * 60 * 1000) {
    void prisma.globalMobileSession.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});
  }
  return { identity, session: { id: record.id, expiresAt: record.expiresAt } };
}

export async function revokeGlobalMobileSession(id: string) {
  await prisma.globalMobileSession.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
