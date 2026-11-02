// Narrow, auditable non-financial officer management on Android.
// The web account-management policy stays authoritative: active organization
// administrator, protected global accounts, self-lock and last-admin safeguards.
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ApiFailure, handler, preflight, readJson } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { isAdminRole } from '@/lib/roles';
import { isReservedGlobalAdminEmail } from '@/lib/super-admin';
import { canRunMobileTenantUserWrites, mobileTenantUserWriteEnvironment } from '@/lib/mobile/production-readonly';

type Ctx = { params: Promise<{ org: string }> };
export const dynamic = 'force-dynamic';
const VALID_STATUSES = ['Active', 'Inactive', 'Blocked'] as const;
type Status = typeof VALID_STATUSES[number];

async function requireAdministrator(req: Request, slug: string) {
  const ctx = await requireMobileOfficer(req, slug, 'tab-users');
  if (!isAdminRole(ctx.officer.role)) {
    throw new ApiFailure(403, 'forbidden', 'Only department administrators can manage officer accounts.');
  }
  return ctx;
}

export const GET = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const { org } = await requireAdministrator(req, slug);
  const query = new URL(req.url).searchParams;
  const q = (query.get('q') ?? '').trim();
  if (q.length > 80) throw new ApiFailure(400, 'invalid', 'Search is too long.');
  const cursor = query.get('cursor');
  if (cursor && !/^[A-Za-z0-9_-]{1,120}$/.test(cursor)) {
    throw new ApiFailure(400, 'invalid_cursor', 'Officer list cursor is invalid.');
  }
  if (cursor && !(await prisma.tenantUser.findFirst({
    where: { id: cursor, organizationId: org.id }, select: { id: true },
  }))) throw new ApiFailure(400, 'invalid_cursor', 'Officer list cursor belongs to another scope.');

  const where: Prisma.TenantUserWhereInput = { organizationId: org.id,
    ...(q ? { OR: [
      { fullName: { contains: q, mode: 'insensitive' as const } },
      { email: { contains: q, mode: 'insensitive' as const } },
      { username: { contains: q, mode: 'insensitive' as const } },
    ] } : {}),
  };
  const rows = await prisma.tenantUser.findMany({
    where, orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: 51,
    select: { id: true, fullName: true, email: true, username: true,
      role: true, status: true, updatedAt: true },
  });
  const page = rows.slice(0, 50);
  return {
    records: page.map(user => ({
      ...user, updatedAt: user.updatedAt.toISOString(),
    })),
    hasMore: rows.length > 50,
    nextCursor: rows.length > 50 ? page[page.length - 1]?.id ?? null : null,
  };
});

export const POST = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const { org, officer } = await requireAdministrator(req, slug);
  if (!canRunMobileTenantUserWrites(mobileTenantUserWriteEnvironment())) {
    throw new ApiFailure(403, 'read_only', 'Officer status editing is not enabled on the server.');
  }
  const body = await readJson<{ id: string; status: string; expectedUpdatedAt: string }>(req);
  if (typeof body.id !== 'string' || !/^[A-Za-z0-9_-]{1,120}$/.test(body.id) ||
      typeof body.status !== 'string' || !VALID_STATUSES.includes(body.status as Status) ||
      typeof body.expectedUpdatedAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(body.expectedUpdatedAt) ||
      !Number.isFinite(Date.parse(body.expectedUpdatedAt)) ||
      new Date(body.expectedUpdatedAt).toISOString() !== body.expectedUpdatedAt) {
    throw new ApiFailure(400, 'invalid', 'Choose a valid account, status and current version.');
  }
  const target = await prisma.tenantUser.findFirst({
    where: { id: body.id, organizationId: org.id },
    select: { id: true, email: true },
  });
  if (!target) throw new ApiFailure(404, 'not_found', 'Officer account not found in this department.');
  if (await isReservedGlobalAdminEmail(target.email)) {
    throw new ApiFailure(403, 'forbidden', 'Protected Global Administrator accounts cannot be edited.');
  }
  const nextStatus = body.status as Status;
  const expected = new Date(body.expectedUpdatedAt);
  try {
    return await prisma.$transaction(async tx => {
      const current = await tx.tenantUser.findFirst({
        where: { id: target.id, organizationId: org.id },
        select: { id: true, status: true, role: true, email: true, updatedAt: true },
      });
      if (!current || current.updatedAt.getTime() !== expected.getTime() ||
          current.email.trim().toLowerCase() !== target.email.trim().toLowerCase()) {
        throw new ApiFailure(409, 'conflict', 'Officer details changed. Refresh before saving.');
      }
      if (current.status === nextStatus) return { success: true };
      if (current.id === officer.id && nextStatus !== 'Active') {
        throw new ApiFailure(403, 'forbidden', 'You cannot disable your own signed-in account.');
      }
      if (isAdminRole(current.role) && current.status === 'Active' && nextStatus !== 'Active') {
        const others = await tx.tenantUser.count({ where: {
          organizationId: org.id, status: 'Active',
          role: { in: ['admin', 'Admin', 'administrator', 'master'] },
          NOT: { id: current.id },
        } });
        if (!others) throw new ApiFailure(409, 'conflict', 'At least one active administrator must remain.');
      }
      const changed = await tx.tenantUser.updateMany({
        where: { id: current.id, organizationId: org.id, updatedAt: expected },
        data: { status: nextStatus, otpCode: null, otpExpires: null, otpAttempts: 0 },
      });
      if (changed.count !== 1) throw new ApiFailure(409, 'conflict', 'Officer details changed. Refresh before saving.');
      if (nextStatus !== 'Active') {
        await tx.mobileSession.updateMany({
          where: { tenantUserId: current.id, organizationId: org.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await tx.systemLog.create({ data: {
        organizationId: org.id, user: officer.email, action: 'UPDATE_TENANT_USER_STATUS',
        details: `${current.id}: ${current.status} => ${nextStatus}`,
      } });
      return { success: true };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2034') {
      throw new ApiFailure(409, 'conflict', 'Account was updated concurrently. Refresh and retry.');
    }
    throw error;
  }
});
export const OPTIONS = preflight;
