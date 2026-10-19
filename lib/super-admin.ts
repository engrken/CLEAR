// lib/super-admin.ts
import 'server-only';
import { prisma } from '@/lib/prisma';

// Compatibility for the original Vercel-managed, non-revocable bootstrap account.
export function isSuperAdminEmail(email?: string | null): boolean {
  const configured = String(process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  const clean = String(email || '').trim().toLowerCase();
  return Boolean(configured && clean && configured === clean);
}

export const normalizeGlobalAdminEmail = (value: unknown) =>
  String(value ?? '').trim().toLowerCase();

export type GlobalIdentity = {
  id: string;
  email: string;
  fullName: string;
  sessionVersion: number;
  source: 'bootstrap' | 'database';
};

export async function findEligibleGlobalAdmin(email: string):
  Promise<GlobalIdentity | null> {
  const clean = normalizeGlobalAdminEmail(email);
  if (!clean) return null;
  if (isSuperAdminEmail(clean)) return {
    id: 'bootstrap', email: clean, fullName: 'Primary Super Admin',
    sessionVersion: 1, source: 'bootstrap',
  };
  const row = await prisma.globalSuperAdmin.findUnique({ where: { email: clean } });
  if (!row || (row.status !== 'Active' && row.status !== 'Pending')) return null;
  if (row.status === 'Pending' && row.invitationExpiresAt <= new Date()) return null;
  return { id: row.id, email: row.email, fullName: row.fullName,
    sessionVersion: row.sessionVersion, source: 'database' };
}

export async function isGlobalSuperAdminEmail(email: string): Promise<boolean> {
  return (await findEligibleGlobalAdmin(email)) !== null;
}

export async function isReservedGlobalAdminEmail(email: unknown): Promise<boolean> {
  const clean = normalizeGlobalAdminEmail(email);
  if (!clean) return false;
  if (isSuperAdminEmail(clean)) return true;
  return Boolean(await prisma.globalSuperAdmin.findUnique({
    where: { email: clean }, select: { id: true },
  }));
}

/** DB membership is revalidated on EVERY privileged request, not trusted from JWT alone. */
export async function verifyGlobalAdminSession(user: {
  email?: string | null; role?: string | null;
  globalAdminId?: string | null; globalAdminVersion?: number | null;
}): Promise<GlobalIdentity | null> {
  const email = normalizeGlobalAdminEmail(user.email);
  if (!email || String(user.role || '').replace(/[\s_-]/g, '').toLowerCase() !== 'superadmin') return null;
  if (isSuperAdminEmail(email)) {
    if (user.globalAdminId && user.globalAdminId !== 'bootstrap') return null;
    return { id: 'bootstrap', email, fullName: 'Primary Super Admin',
      sessionVersion: 1, source: 'bootstrap' };
  }
  if (!user.globalAdminId || !Number.isSafeInteger(user.globalAdminVersion)) return null;
  const row = await prisma.globalSuperAdmin.findUnique({
    where: { id: user.globalAdminId },
    select: { id: true, email: true, fullName: true, status: true, sessionVersion: true },
  });
  if (!row || row.email !== email || row.status !== 'Active' ||
      row.sessionVersion !== user.globalAdminVersion) return null;
  return { id: row.id, email, fullName: row.fullName,
    sessionVersion: row.sessionVersion, source: 'database' };
}
