// /lib/permissions.ts

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

export function isSuperAdminEmail(email?: string | null): boolean {
  const clean = String(email || "").trim().toLowerCase();
  // No hardcoded fallback (F2): with SUPER_ADMIN_EMAIL unset, nobody is Super Admin.
  const configured = String(process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
  return Boolean(clean && configured && clean === configured);
}

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

/** The caller as resolved by requireDepartmentAccess (session + live membership). */
export interface AccessUser {
  id?: string;
  name?: string | null;
  fullName?: string;
  email: string;
  username?: string;
  role?: string;
  allowedTabs?: unknown;
  organizationId: string;
  department: string;
}

export function normalizeDepartmentSlug(department: string): string {
  let raw = String(department || "");
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Malformed escape sequence: fall through with the raw value (it will not match a subdomain)
  }
  return raw.trim().toLowerCase();
}

export function isAdminRole(role?: string | null): boolean {
  return ["admin", "administrator", "master", "superadmin", "super_admin"].includes(
    String(role || "").trim().toLowerCase()
  );
}

/**
 * The single tenant guard for server actions, route handlers and pages.
 *
 * - Always resolves the organization on the server from the department slug;
 *   callers must use `org.id` and never trust an organizationId sent by the client.
 * - Requires an Active TenantUser membership in that organization (matched by the
 *   session email), or the configured Super Admin.
 * - Re-reads role and allowed tabs from the database, so revoked access applies
 *   immediately instead of after the 6-hour JWT expires.
 * - Pass `requiredTab: null` to require membership only (any role).
 */
export async function requireDepartmentAccess(requiredTab: string | null, department: string) {
  const session = await auth();
  if (!session?.user) throw new Error("401 Unauthorized: Session expired or invalid.");

  const sessionUser = session.user as Partial<AccessUser>;
  const sessionEmail = String(sessionUser.email || "").trim().toLowerCase();
  if (!sessionEmail) throw new Error("401 Unauthorized: Session expired or invalid.");

  const cleanDept = normalizeDepartmentSlug(department);
  if (!cleanDept) throw new Error("Department is required.");

  const org = await prisma.organization.findUnique({ where: { subdomain: cleanDept } });
  if (!org) throw new Error(`Organization "${cleanDept}" not found.`);

  const isSuper = isSuperAdminEmail(sessionEmail);
  const user: AccessUser = { ...sessionUser, email: sessionEmail, organizationId: org.id, department: org.subdomain };

  if (isSuper) {
    user.role = "SuperAdmin";
    user.fullName = sessionUser.name || "Super Admin";
  } else {
    const member = await prisma.tenantUser.findFirst({
      where: {
        organizationId: org.id,
        email: { equals: sessionEmail, mode: "insensitive" },
        status: "Active",
      },
    });
    if (!member) throw new Error("403 Forbidden: You do not belong to this organization.");

    user.id = member.id;
    user.role = member.role;
    user.allowedTabs = parseAllowedTabs(member.allowedTabs);
    user.name = member.fullName;
    user.fullName = member.fullName;
    user.username = member.username;
  }

  if (requiredTab && !isSuper && !isAdminRole(user.role)) {
    const role = String(user.role || "viewer").trim().toLowerCase();
    const explicitTabs = parseAllowedTabs(user.allowedTabs);
    const effectiveTabs = explicitTabs.length > 0 ? explicitTabs : (PRESET_ROLE_TABS[role] || PRESET_ROLE_TABS.viewer);
    if (!effectiveTabs.includes(requiredTab)) {
      throw new Error(`403 Forbidden: Your account scope lacks permission for the ${requiredTab} module.`);
    }
  }

  return { user, org, isSuperAdmin: isSuper };
}

/**
 * Backwards-compatible wrapper around requireDepartmentAccess. `department` is
 * required: calling it without one used to skip the membership check entirely.
 */
export async function requireTabAccess(requiredTab: string, department: string) {
  const { user } = await requireDepartmentAccess(requiredTab, department);
  return user;
}