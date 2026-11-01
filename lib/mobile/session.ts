// /lib/mobile/session.ts
//
// Bearer-token sessions for the mobile app. The token is 32 random bytes; only
// its SHA-256 hash is stored (MobileSession.tokenHash). Each request re-checks
// the officer's status, role and tabs, so deactivating or demoting an officer
// takes effect immediately. A token only works for the org it was issued in.

import crypto from 'node:crypto';
import type { Organization, TenantUser } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hasTabAccess, isOrganizationActive, normalizeDepartmentSlug } from '@/lib/roles';
import { ApiFailure } from '@/lib/mobile/http';

export const MOBILE_SESSION_DAYS = 7;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || '';
  const match = /^Bearer\s+([A-Za-z0-9_-]{20,200})$/.exec(header.trim());
  return match ? match[1] : null;
}

export async function createMobileSession(user: TenantUser, org: Organization, userAgent: string | null) {
  const token = 'clr_' + crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + MOBILE_SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.mobileSession.create({
    data: {
      id: crypto.randomUUID(),
      tokenHash: hashToken(token),
      tenantUserId: user.id,
      organizationId: org.id,
      expiresAt,
      userAgent: userAgent ? userAgent.slice(0, 200) : null,
    },
  });
  return { token, expiresAt };
}

export type MobileOfficerContext = {
  officer: TenantUser;
  org: Organization;
  session: { id: string; expiresAt: Date };
};

const SESSION_ENDED = 'Your session has ended. Sign in again.';

/** Resolves the bearer token to an active session, or null when there is none. */
async function loadSession(req: Request) {
  const token = bearerToken(req);
  if (!token) return null;
  const session = await prisma.mobileSession.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { TenantUser: true, Organization: true },
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  return session;
}

/**
 * Requires a valid officer token for the org in the path. `tabs` lists the
 * permission tabs that grant access (any one is enough); null = any officer.
 */
export async function requireMobileOfficer(
  req: Request,
  orgSlug: string,
  tabs: string | string[] | null
): Promise<MobileOfficerContext> {
  const session = await loadSession(req);
  if (!session) throw new ApiFailure(401, 'unauthorized', SESSION_ENDED);

  const { TenantUser: officer, Organization: org } = session;
  if (officer.organizationId !== org.id || session.organizationId !== org.id || session.tenantUserId !== officer.id) {
    throw new ApiFailure(403, 'forbidden', 'Session tenant membership is inconsistent.');
  }
  if (officer.status !== 'Active') {
    await prisma.mobileSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    throw new ApiFailure(401, 'unauthorized', 'This officer account is no longer active.');
  }
  if (!isOrganizationActive(org)) {
    throw new ApiFailure(403, 'forbidden', `This department is currently ${String(org.status).toLowerCase()} in CLEAR.`);
  }
  if (org.subdomain !== normalizeDepartmentSlug(orgSlug)) {
    throw new ApiFailure(403, 'forbidden', 'This sign-in is for a different department.');
  }

  const required = tabs === null ? [] : Array.isArray(tabs) ? tabs : [tabs];
  if (required.length > 0 && !required.some((t) => hasTabAccess(officer.role, officer.allowedTabs, t))) {
    throw new ApiFailure(403, 'forbidden', 'Your role does not have access to this.');
  }

  if (Date.now() - session.lastUsedAt.getTime() > TOUCH_INTERVAL_MS) {
    prisma.mobileSession
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }

  return { officer, org, session: { id: session.id, expiresAt: session.expiresAt } };
}

/** Like requireMobileOfficer but returns null instead of failing (for public endpoints). */
export async function optionalMobileOfficer(req: Request, orgSlug: string, tab: string) {
  try {
    return await requireMobileOfficer(req, orgSlug, tab);
  } catch {
    return null;
  }
}

export async function revokeMobileSession(sessionId: string) {
  await prisma.mobileSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
}
