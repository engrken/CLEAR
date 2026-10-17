// /lib/permissions.ts

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSuperAdminEmail } from "@/lib/super-admin";

export const PRESET_ROLE_TABS: Record<string, string[]> = {
  admin: [
    "tab-overview", "tab-students", "tab-clearance", "tab-payment",
    "tab-remittances", "tab-penalties", "tab-advances", "tab-audit",
    "tab-collectibles", "tab-reports", "tab-void", "tab-report",
    "tab-transfer", "tab-users", "tab-setup",
  ],
  treasurer: [
    "tab-overview", "tab-clearance", "tab-reports", "tab-payment",
    "tab-remittances", "tab-penalties", "tab-advances", "tab-collectibles",
    "tab-report", "tab-transfer",
  ],
  auditor: ["tab-overview", "tab-clearance", "tab-reports", "tab-audit", "tab-report"],
  viewer: ["tab-overview", "tab-clearance", "tab-reports", "tab-report"],
};

// Fails closed (no hardcoded fallback address). Implementation lives in lib/super-admin.ts.
export { isSuperAdminEmail };

export function parseAllowedTabs(tabs: unknown): string[] {
  if (Array.isArray(tabs)) return tabs.filter((v): v is string => typeof v === "string");
  if (typeof tabs === "string") {
    try {
      const parsed = JSON.parse(tabs);
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
    } catch { return []; }
  }
  return [];
}

const ADMIN_ROLES = ["admin", "administrator", "master", "superadmin", "super_admin"];

function cleanSlug(department: string): string {
  let d = String(department || "");
  try { d = decodeURIComponent(d); } catch { /* keep raw */ }
  return d.trim().toLowerCase();
}

export async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error("401 Unauthorized: Session expired or invalid.");
  const user = session.user as any;
  const role = String(user.role || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  if ((role !== "superadmin" && role !== "master") || !isSuperAdminEmail(user.email)) {
    throw new Error("403 Forbidden: Super administrator privileges are required.");
  }
  return user;
}

// ---------------------------------------------------------------------------
// Shared core: who is calling, and what are they in THIS organization?
// Membership, role and tabs always come from the database, never from the JWT.
// ---------------------------------------------------------------------------
async function loadAccess(department: string) {
  const session = await auth();
  if (!session?.user) throw new Error("401 Unauthorized: Session expired or invalid.");

  const sessionUser = session.user as any;
  const sessionEmail = String(sessionUser.email || "").trim().toLowerCase();
  const isSuper = isSuperAdminEmail(sessionEmail);

  const cleanDept = cleanSlug(department);
  if (!cleanDept) throw new Error("Organization not found.");

  const org = await prisma.organization.findUnique({
    where: { subdomain: cleanDept },
    select: { id: true, status: true, name: true },
  });
  if (!org) throw new Error(`Organization "${cleanDept}" not found.`);

  // Inactive or archived tenants are closed to everyone except the Super Admin.
  if (org.status && org.status !== "Active" && !isSuper) {
    throw new Error(`This department is currently ${org.status.toLowerCase()} and cannot be accessed.`);
  }

  if (isSuper) {
    return {
      sessionUser, sessionEmail, isSuper, org,
      id: String(sessionUser.id || "SuperAdmin"),
      name: String(sessionUser.name || "Super Administrator"),
      role: String(sessionUser.role || "SuperAdmin"),
      allowedTabs: parseAllowedTabs(sessionUser.allowedTabs),
    };
  }

  const member = await prisma.tenantUser.findFirst({
    where: { organizationId: org.id, email: { equals: sessionEmail, mode: "insensitive" }, status: "Active" },
  });
  if (!member) throw new Error("403 Forbidden: You do not belong to this organization.");

  return {
    sessionUser, sessionEmail, isSuper, org,
    id: member.id,
    name: member.fullName,
    role: member.role,
    allowedTabs: parseAllowedTabs(member.allowedTabs),
  };
}

function buildUser(a: Awaited<ReturnType<typeof loadAccess>>) {
  return {
    ...a.sessionUser,
    id: a.id,
    name: a.name,
    fullName: a.name,
    email: a.sessionEmail,
    role: a.role,
    allowedTabs: a.allowedTabs,
    organizationId: a.org.id,
    organizationName: a.org.name,
    isSuper: a.isSuper,
  };
}

/**
 * `department` is REQUIRED. Calling requireTabAccess("tab-x") with one argument used to skip the
 * organization-membership check, which let a user from Organization A act on Organization B.
 * TypeScript now rejects any such call.
 */
export async function requireTabAccess(requiredTab: string, department: string) {
  const a = await loadAccess(department);

  const role = String(a.role || "viewer").trim().toLowerCase();
  if (!a.isSuper && !ADMIN_ROLES.includes(role)) {
    const effectiveTabs = a.allowedTabs.length > 0
      ? a.allowedTabs
      : (PRESET_ROLE_TABS[role] || PRESET_ROLE_TABS.viewer);
    if (!effectiveTabs.includes(requiredTab)) {
      throw new Error(`403 Forbidden: Your account scope lacks permission for the ${requiredTab} module.`);
    }
  }
  return buildUser(a);
}

/** Admin of this organization (or the Super Admin), regardless of tab list. */
export async function requireOrgAdmin(department: string) {
  const a = await loadAccess(department);
  const role = String(a.role || "").trim().toLowerCase();
  if (!a.isSuper && !ADMIN_ROLES.includes(role)) {
    throw new Error("403 Forbidden: Administrator privileges are required.");
  }
  return buildUser(a);
}
