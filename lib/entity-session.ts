// /lib/entity-session.ts
import 'server-only';

import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { isReservedGlobalAdminEmail, verifyGlobalAdminSession } from '@/lib/super-admin';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export type EntitySessionClaims = {
  purpose: 'clear-entity-session';
  email: string;
  role: 'admin' | 'SuperAdmin';
  isSuperAdmin: boolean;
  globalAdminId?: string;
  globalAdminVersion?: number;
  tenantUserId?: string;
  organizationId?: string;
  iat: number;
  exp: number;
};

export type EntityAdminContext = {
  email: string;
  role: 'admin' | 'SuperAdmin';
  isSuperAdmin: boolean;
  tenantUserId: string | null;
  organizationId: string | null;
  organizationName: string | null;
  subdomain: string | null;
  schoolGroup: string | null;
  tier: string | null;
};

function getSigningSecret(): string {
  const secret = String(
    process.env.ENTITY_SESSION_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    ''
  ).trim();

  if (!secret) {
    throw new Error(
      'Entity session signing secret is not configured. Set ENTITY_SESSION_SECRET or AUTH_SECRET.'
    );
  }

  if (secret.length < 32) {
    throw new Error(
      'Entity session signing secret must contain at least 32 characters.'
    );
  }

  return secret;
}

function signatureFor(data: string): Buffer {
  return crypto
    .createHmac('sha256', getSigningSecret())
    .update(data)
    .digest();
}

export function signEntityToken(payload: EntitySessionClaims): string {
  const email = String(payload.email || '').trim().toLowerCase();

  if (
    payload.purpose !== 'clear-entity-session' ||
    !email ||
    !Number.isFinite(payload.iat) ||
    !Number.isFinite(payload.exp) ||
    payload.exp <= Date.now() ||
    payload.iat > Date.now() + 60_000 ||
    payload.iat < Date.now() - SESSION_TTL_MS - 60_000 ||
    payload.exp - payload.iat > SESSION_TTL_MS + 60_000
  ) {
    throw new Error('Invalid entity session payload.');
  }

  if (
    payload.isSuperAdmin !== (payload.role === 'SuperAdmin')
  ) {
    throw new Error('Invalid entity session role.');
  }

  if (
    !payload.isSuperAdmin &&
    (!payload.tenantUserId || !payload.organizationId)
  ) {
    throw new Error(
      'Tenant sessions must identify an organization and its administrator.'
    );
  }

  const data = Buffer
    .from(JSON.stringify({ ...payload, email }))
    .toString('base64url');

  const signature = signatureFor(data).toString('base64url');

  return `${data}.${signature}`;
}

export function verifyEntityToken(
  token: string | undefined
): EntitySessionClaims | null {
  try {
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return null;
    }

    const [data, suppliedSignature] = parts;
    const expected = signatureFor(data);
    const actual = Buffer.from(suppliedSignature, 'base64url');

    if (
      actual.length !== expected.length ||
      !crypto.timingSafeEqual(actual, expected)
    ) {
      return null;
    }

    const parsed: unknown = JSON.parse(
      Buffer.from(data, 'base64url').toString('utf8')
    );

    if (!parsed || typeof parsed !== 'object') return null;

    const claims = parsed as Partial<EntitySessionClaims>;

    if (
      claims.purpose !== 'clear-entity-session' ||
      typeof claims.email !== 'string' ||
      !claims.email.trim() ||
      !Number.isFinite(claims.iat) ||
      !Number.isFinite(claims.exp) ||
      claims.exp! <= Date.now() ||
      claims.iat! > Date.now() + 60_000 ||
      claims.iat! < Date.now() - SESSION_TTL_MS - 60_000 ||
      claims.exp! <= claims.iat! ||
      claims.exp! - claims.iat! > SESSION_TTL_MS + 60_000 ||
      typeof claims.isSuperAdmin !== 'boolean' ||
      !['admin', 'SuperAdmin'].includes(claims.role || '')
    ) {
      return null;
    }

    if (claims.isSuperAdmin !== (claims.role === 'SuperAdmin')) {
      return null;
    }

    if (
      claims.role === 'admin' &&
      (!claims.tenantUserId || !claims.organizationId)
    ) {
      return null;
    }

    if (
      claims.role === 'SuperAdmin' &&
      (claims.tenantUserId || claims.organizationId)
    ) {
      return null;
    }

    return {
      purpose: 'clear-entity-session',
      email: claims.email.trim().toLowerCase(),
      role: claims.role as 'admin' | 'SuperAdmin',
      isSuperAdmin: claims.isSuperAdmin,
      globalAdminId: typeof claims.globalAdminId === 'string' ? claims.globalAdminId : undefined,
      globalAdminVersion: typeof claims.globalAdminVersion === 'number' ? claims.globalAdminVersion : undefined,
      tenantUserId: claims.tenantUserId,
      organizationId: claims.organizationId,
      iat: claims.iat!,
      exp: claims.exp!,
    };
  } catch {
    return null;
  }
}

/**
 * Reads and validates the entity portal session.
 * Tenant sessions are rechecked against the database on every read.
 */
export async function getAuthenticatedEntityAdmin():
  Promise<EntityAdminContext | null> {
	  const cookieStore = await cookies();
    const token = cookieStore.get('clear_entity_session')?.value;
    const claims = verifyEntityToken(token);

    if (!claims) return null;
  try {
    

    if (claims.isSuperAdmin) {
      const permitted = await verifyGlobalAdminSession({
        email: claims.email, role: claims.role,
        globalAdminId: claims.globalAdminId,
        globalAdminVersion: claims.globalAdminVersion,
      });
      if (!permitted) return null;

      return {
        email: claims.email,
        role: 'SuperAdmin',
        isSuperAdmin: true,
        tenantUserId: null,
        organizationId: null,
        organizationName: null,
        subdomain: null,
        schoolGroup: null,
        tier: null,
      };
    }

    if (
      claims.role !== 'admin' ||
      (await isReservedGlobalAdminEmail(claims.email)) ||
      !claims.tenantUserId ||
      !claims.organizationId
    ) {
      return null;
    }

    const user = await prisma.tenantUser.findFirst({
      where: {
        id: claims.tenantUserId,
        organizationId: claims.organizationId,
        email: {
          equals: claims.email,
          mode: 'insensitive',
        },
        status: 'Active',
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            subdomain: true,
            schoolGroup: true,
            tier: true,
            status: true,
          },
        },
      },
    });

    if (!user || !['admin', 'administrator'].includes(
      String(user.role).trim().toLowerCase()
    )) {
      return null;
    }

    if (user.organization.status !== 'Active') {
      return null;
    }

    return {
      email: user.email.trim().toLowerCase(),
      role: 'admin',
      isSuperAdmin: false,
      tenantUserId: user.id,
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      subdomain: user.organization.subdomain,
      schoolGroup: user.organization.schoolGroup || 'default-school',
      tier: user.organization.tier || 'Freemium',
    };
  } catch (error) {
    console.error('Entity session validation failed:', error);
    return null;
  }
}