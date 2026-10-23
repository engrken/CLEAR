import 'server-only';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { presencePageKey, type PresencePage } from '@/lib/collaboration-pages';

export const PRESENCE_TTL_MS = 80_000;
export const PRESENCE_HEARTBEAT_MS = 30_000;
const RETENTION_MS = 20 * 60_000;

export async function updatePagePresence(input: {
  organizationId: string;
  userId: string;
  page: PresencePage;
  ay: string;
  term: string;
  tabId: string;
}) {
  const key = presencePageKey(input.page, input.ay, input.term);
  if (!key || !/^[a-f0-9-]{36}$/.test(input.tabId)) throw new Error('Invalid page presence request');
  const now = new Date();
  const where = { id: input.tabId, organizationId: input.organizationId, tenantUserId: input.userId };
  const updated = await prisma.officerPagePresence.updateMany({
    where,
    data: { pageKey: key, lastSeen: now },
  });
  if (updated.count === 0) {
    // A collision cannot replace another user's presence or grant access.
    await prisma.officerPagePresence.create({
      data: { id: input.tabId, organizationId: input.organizationId, tenantUserId: input.userId, pageKey: key, lastSeen: now },
    });
  }
  // Prune expired entries regularly; stale presence is never displayed.
  await prisma.officerPagePresence.deleteMany({
    where: { organizationId: input.organizationId, lastSeen: { lt: new Date(now.getTime() - RETENTION_MS) } },
  });
  return listPagePresence(input.organizationId, input.userId, key);
}

export async function listPagePresence(organizationId: string, currentUserId: string, pageKey: string) {
  const rows = await prisma.officerPagePresence.findMany({
    where: {
      organizationId,
      pageKey,
      lastSeen: { gte: new Date(Date.now() - PRESENCE_TTL_MS) },
      officer: { status: 'Active', organizationId },
    },
    select: { tenantUserId: true, officer: { select: { fullName: true } } },
    orderBy: { lastSeen: 'desc' },
    take: 100,
  });
  const seen = new Set<string>();
  const officers: { id: string; name: string }[] = [];
  for (const row of rows) {
    if (row.tenantUserId === currentUserId || seen.has(row.tenantUserId)) continue;
    seen.add(row.tenantUserId);
    officers.push({ id: row.tenantUserId, name: row.officer.fullName });
  }
  return { colleagues: officers.slice(0, 12), count: officers.length };
}

export async function leavePagePresence(organizationId: string, userId: string, tabId: string) {
  if (!/^[a-f0-9-]{36}$/.test(tabId)) return;
  await prisma.officerPagePresence.deleteMany({ where: { id: tabId, organizationId, tenantUserId: userId } });
}

/** Versioned per-role/per-permission onboarding, not merely per-browser localStorage. */
export function onboardingSignature(role: string, tabs: string[]) {
  const normalized = role.trim().toLowerCase();
  const signature = createHash('sha256').update(
    JSON.stringify(['clear-walkthrough-v1', normalized, [...new Set(tabs)].sort()])
  ).digest('hex');
  return 'v1:' + signature;
}
export async function getOnboardingState(userId: string, role: string, tabs: string[]) {
  if (role.trim().toLowerCase() === 'superadmin') return { exempt: true, completed: true, tabs: [] as string[] };
  const user = await prisma.tenantUser.findUnique({ where: { id: userId }, select: { onboardingSignature: true } });
  if (!user) throw new Error('Officer account unavailable');
  return { exempt: false, completed: user.onboardingSignature === onboardingSignature(role, tabs), tabs };
}
export async function completeOnboarding(userId: string, role: string, tabs: string[]) {
  if (role.trim().toLowerCase() === 'superadmin') return { exempt: true, completed: true };
  const changed = await prisma.tenantUser.updateMany({
    where: { id: userId, status: 'Active' },
    data: { onboardingSignature: onboardingSignature(role, tabs) },
  });
  if (changed.count !== 1) throw new Error('Unable to complete walkthrough');
  return { exempt: false, completed: true };
}
