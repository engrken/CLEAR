import 'server-only';

import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { isSuperAdminEmail, isReservedGlobalAdminEmail, verifyGlobalAdminSession } from '@/lib/super-admin';
import { PRESET_ROLE_TABS, parseAllowedTabs } from '@/lib/role-permissions';
import { assertTenantSessionScope } from '@/lib/tenant-session-scope';

export { isSuperAdminEmail, isReservedGlobalAdminEmail, PRESET_ROLE_TABS, parseAllowedTabs };

const ADMIN_ROLES = new Set(['admin', 'administrator', 'master']);
const ALL_TABS = new Set(Object.values(PRESET_ROLE_TABS).flat());

function normalizeDepartment(department: string): string {
  let slug: string;
  try { slug = decodeURIComponent(String(department ?? '')).trim().toLowerCase(); }
  catch { throw new Error('Invalid department identifier.'); }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) {
    throw new Error('Invalid department identifier.');
  }
  return slug;
}

async function isSignedInSuperAdmin(user: any): Promise<boolean> {
  return Boolean(await verifyGlobalAdminSession({
    email: user?.email, role: user?.role,
    globalAdminId: user?.globalAdminId,
    globalAdminVersion: user?.globalAdminVersion,
  }));
}

export async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('401 Unauthorized: Session expired or invalid.');
  if (!(await isSignedInSuperAdmin(session.user))) {
    throw new Error('403 Forbidden: Super administrator privileges are required.');
  }
  return session.user;
}

async function loadAccess(department: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error('401 Unauthorized: Session expired or invalid.');
  const sessionUser = session.user as any;
  const email = String(sessionUser.email).trim().toLowerCase();
  const isSuper = await isSignedInSuperAdmin(sessionUser);
  // Fail closed if a normal session somehow contains the privileged email.
  if ((await isReservedGlobalAdminEmail(email)) && !isSuper) throw new Error('403 Forbidden: Invalid Super Admin session.');

  const slug = normalizeDepartment(department);
  const org = await prisma.organization.findUnique({
    where: { subdomain: slug },
    select: { id: true, name: true, status: true },
  });
  if (!org) throw new Error('Organization not found.');
  if (String(org.status ?? '').toLowerCase() !== 'active' && !isSuper) {
    throw new Error('This organization is currently inactive or archived.');
  }

  if (isSuper) {
    return {
      sessionUser, email, isSuper, org, id: String(sessionUser.id || 'SuperAdmin'),
      name: String(sessionUser.name || 'Super Administrator'), role: 'SuperAdmin',
      allowedTabs: [...ALL_TABS],
    };
  }

  // The signed-in officer's organization must match the requested tenant.
  // A shared email address across tenant rosters is not an authorization grant.
  assertTenantSessionScope(sessionUser.organizationId, org.id);

  // Role and tab scope MUST come from a currently active tenant database record.
  const member = await prisma.tenantUser.findFirst({
    where: { organizationId: org.id, email: { equals: email, mode: 'insensitive' }, status: 'Active' },
  });
  if (!member) throw new Error('403 Forbidden: You do not belong to this organization.');
  const tabs = parseAllowedTabs(member.allowedTabs).filter(tab => ALL_TABS.has(tab));
  return {
    sessionUser, email, isSuper, org, id: member.id,
    name: member.fullName, role: member.role, allowedTabs: tabs,
  };
}

type Access = Awaited<ReturnType<typeof loadAccess>>;
function buildUser(a: Access) {
  return {
    ...a.sessionUser,
    id: a.id, name: a.name, fullName: a.name, email: a.email,
    role: a.role, allowedTabs: a.allowedTabs,
    organizationId: a.org.id, organizationName: a.org.name, isSuper: a.isSuper,
  };
}

/** Always supply department; never authorize based only on caller-provided organization IDs. */
export async function requireTabAccess(requiredTab: string, department: string) {
  if (!ALL_TABS.has(requiredTab)) throw new Error('403 Forbidden: Unknown module permission.');
  const access = await loadAccess(department);
  const role = String(access.role).trim().toLowerCase();
  if (!access.isSuper && !ADMIN_ROLES.has(role)) {
    // An empty allowedTabs string retains the existing preset-role fallback policy.
    const effectiveTabs = access.allowedTabs.length > 0
      ? access.allowedTabs
      : (PRESET_ROLE_TABS[role] || PRESET_ROLE_TABS.viewer);
    if (!effectiveTabs.includes(requiredTab)) {
      throw new Error(`403 Forbidden: Your account scope lacks permission for ${requiredTab}.`);
    }
  }
  return buildUser(access);
}

export async function requireOrgAdmin(department: string) {
  const access = await loadAccess(department);
  if (!access.isSuper && !ADMIN_ROLES.has(String(access.role).trim().toLowerCase())) {
    throw new Error('403 Forbidden: Administrator privileges are required.');
  }
  return buildUser(access);
}
