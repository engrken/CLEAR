// Authorized non-cash officer create/update. Kept separate from status-only
// changes, with its own default-off production rollout and audit trail.
import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ApiFailure, handler, preflight, readJson } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { isAdminRole } from '@/lib/roles';
import { PRESET_ROLE_TABS, parseAllowedTabs } from '@/lib/role-permissions';
import { isReservedGlobalAdminEmail } from '@/lib/super-admin';
import { canRunMobileTenantUserManageWrites, mobileTenantUserWriteEnvironment } from '@/lib/mobile/production-readonly';

type Ctx = { params: Promise<{ org: string }> };
type Action = 'create' | 'update';
type Status = 'Active' | 'Inactive' | 'Blocked';
type ManagePayload = {
  action: Action; id?: string; expectedUpdatedAt?: string;
  fullName: string; email: string; username: string; role: string;
  status: Status; allowedTabs: string[];
};
const statuses = new Set<string>(['Active', 'Inactive', 'Blocked']);
const knownTabs = new Set(Object.values(PRESET_ROLE_TABS).flat());
const versionFormat = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
export const dynamic = 'force-dynamic';

const normalize = (value: unknown) => typeof value === 'string' ? value.trim() : '';
function parsePayload(payload: Partial<ManagePayload>) {
  if (payload.action !== 'create' && payload.action !== 'update') {
    throw new ApiFailure(400, 'invalid', 'Choose create or update.');
  }
  const fullName = normalize(payload.fullName);
  const email = normalize(payload.email).toLowerCase();
  const username = normalize(payload.username).toLowerCase();
  const role = normalize(payload.role).toLowerCase();
  const status = payload.status;
  if (fullName.length < 2 || fullName.length > 120 ||
      /[\x00-\x1f\x7f]/.test(fullName) ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !/^[a-z0-9][a-z0-9._-]{2,47}$/.test(username) ||
      !Object.prototype.hasOwnProperty.call(PRESET_ROLE_TABS, role) ||
      !statuses.has(String(status)) ||
      !Array.isArray(payload.allowedTabs) || payload.allowedTabs.length > knownTabs.size ||
      payload.allowedTabs.some(tab => typeof tab !== 'string' || !knownTabs.has(tab))) {
    throw new ApiFailure(400, 'invalid', 'Officer details, role, permissions or status are invalid.');
  }
  const allowedTabs = Array.from(new Set(payload.allowedTabs));
  // Matching web behavior: blank custom tabs mean role defaults.
  const savedTabs = allowedTabs.length ? allowedTabs : [...PRESET_ROLE_TABS[role]];
  const id = normalize(payload.id);
  const stamp = normalize(payload.expectedUpdatedAt);
  if (payload.action === 'update' &&
      (!/^[A-Za-z0-9_-]{1,120}$/.test(id) || !versionFormat.test(stamp) ||
       !Number.isFinite(Date.parse(stamp)) || new Date(stamp).toISOString() !== stamp)) {
    throw new ApiFailure(400, 'invalid', 'Refresh the officer before editing.');
  }
  if (payload.action === 'create' && (id || stamp)) {
    throw new ApiFailure(400, 'invalid', 'Creating an officer cannot target an existing account.');
  }
  return { action: payload.action, id, expected: stamp ? new Date(stamp) : null,
    fullName, email, username, role, status: status as Status,
    allowedTabs: JSON.stringify(savedTabs) };
}

export const POST = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const { officer, org } = await requireMobileOfficer(req, slug, 'tab-users');
  if (!isAdminRole(officer.role)) throw new ApiFailure(403, 'forbidden', 'Administrator access required.');
  if (!canRunMobileTenantUserManageWrites(mobileTenantUserWriteEnvironment())) {
    throw new ApiFailure(403, 'read_only', 'Native officer creation and role changes are not enabled.');
  }
  const payload = parsePayload(await readJson<ManagePayload>(req));
  if (await isReservedGlobalAdminEmail(payload.email)) {
    throw new ApiFailure(403, 'forbidden', 'This email is reserved for Global Administration.');
  }
  try {
    return await prisma.$transaction(async tx => {
      const current = payload.action === 'update' ? await tx.tenantUser.findFirst({
        where: { id: payload.id, organizationId: org.id },
        select: { id: true, email: true, role: true, status: true, updatedAt: true,
          fullName: true, username: true, allowedTabs: true },
      }) : null;
      if (payload.action === 'update' && !current) {
        throw new ApiFailure(404, 'not_found', 'Officer does not belong to this tenant.');
      }
      if (current && current.updatedAt.getTime() !== payload.expected?.getTime()) {
        throw new ApiFailure(409, 'conflict', 'Officer changed. Refresh before saving.');
      }
      if (current && await isReservedGlobalAdminEmail(current.email)) {
        throw new ApiFailure(403, 'forbidden', 'Protected Global Administrator cannot be edited.');
      }
      // Self-administered identity and permission changes belong to independently
      // verified web/profile flows, not the same signed-in mobile session.
      if (current?.id === officer.id) {
        throw new ApiFailure(403, 'forbidden', 'Use your own secured profile workflow for this account.');
      }
      if (current && isAdminRole(current.role) && current.status === 'Active' &&
          (!isAdminRole(payload.role) || payload.status !== 'Active')) {
        const otherAdmins = await tx.tenantUser.count({ where: {
          organizationId: org.id, status: 'Active',
          role: { in: ['admin', 'Admin', 'administrator', 'master'] },
          NOT: { id: current.id },
        } });
        if (!otherAdmins) {
          throw new ApiFailure(409, 'conflict', 'At least one active administrator must remain.');
        }
      }
      const duplicate = await tx.tenantUser.findFirst({ where: {
        organizationId: org.id,
        ...(current ? { NOT: { id: current.id } } : {}),
        OR: [
          { email: { equals: payload.email, mode: 'insensitive' } },
          { username: { equals: payload.username, mode: 'insensitive' } },
        ],
      }, select: { id: true } });
      if (duplicate) throw new ApiFailure(409, 'conflict', 'Email or username already exists in this tenant.');
      const data = {
        fullName: payload.fullName, email: payload.email,
        username: payload.username, role: payload.role, status: payload.status,
        allowedTabs: payload.allowedTabs,
      };
      let id: string;
      if (current) {
        const affected = await tx.tenantUser.updateMany({
          where: { id: current.id, organizationId: org.id, updatedAt: payload.expected! },
          data: { ...data, otpCode: null, otpExpires: null, otpAttempts: 0 },
        });
        if (affected.count !== 1) throw new ApiFailure(409, 'conflict', 'Officer changed. Refresh before saving.');
        id = current.id;
        // A prior mobile session must never retain old privileges after an
        // identity, role, custom tab or status mutation.
        await tx.mobileSession.updateMany({ where: {
          organizationId: org.id, tenantUserId: id, revokedAt: null,
        }, data: { revokedAt: new Date() } });
      } else {
        const created = await tx.tenantUser.create({ data: {
          ...data, userId: 'USR-' + randomBytes(8).toString('hex').toUpperCase(),
          organizationId: org.id,
        } });
        id = created.id;
      }
      await tx.systemLog.create({ data: {
        organizationId: org.id, user: officer.email,
        action: current ? 'UPDATE_TENANT_USER' : 'CREATE_TENANT_USER',
        details: `${id}: role=${payload.role}, status=${payload.status}, tabs=${parseAllowedTabs(payload.allowedTabs).length}`,
      } });
      return { success: true, id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof ApiFailure) throw error;
    const code = (error as { code?: string })?.code;
    if (code === 'P2002' || code === 'P2034') {
      throw new ApiFailure(409, 'conflict', 'Officer records changed or already exist. Refresh and retry.');
    }
    throw error;
  }
});
export const OPTIONS = preflight;
