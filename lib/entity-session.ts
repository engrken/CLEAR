// /lib/entity-session.ts
//
// Signed session cookie for the Entity Admin portal (/dashboard/entity). The
// cookie holds only the admin's email and an expiry; the one-time code that
// leads to it is stored hashed in the database (VerificationToken), never in a
// cookie. Server-only: kept out of 'use server' files so these helpers are not
// exposed as callable server actions.

import crypto from 'node:crypto';
import { cookies } from 'next/headers';

export const ENTITY_SESSION_COOKIE = 'clear_entity_session';
export const ENTITY_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function secret(): string {
  const value = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error('AUTH_SECRET is not configured.');
  return value;
}

function sign(data: string) {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url');
}

export function signEntityToken(payload: { email: string; exp: number }): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data)}`;
}

export function verifyEntityToken(token: string | undefined): { email: string; exp: number } | null {
  if (!token) return null;
  const [data, signature] = token.split('.');
  if (!data || !signature) return null;

  const expected = Buffer.from(sign(data));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (typeof parsed?.email !== 'string' || typeof parsed?.exp !== 'number' || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** The signed-in Entity Admin's email, or null. */
export async function getAuthenticatedEntityAdmin(): Promise<string | null> {
  const cookieStore = await cookies();
  return verifyEntityToken(cookieStore.get(ENTITY_SESSION_COOKIE)?.value)?.email ?? null;
}

/** VerificationToken identifier for an Entity Admin sign-in code. */
export function entityOtpIdentifier(email: string) {
  return `entity-admin:${email.trim().toLowerCase()}`;
}
