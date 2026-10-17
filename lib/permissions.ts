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
  const configured = String(process.env.SUPER_ADMIN_EMAIL || "kent.bsece@gmail.com").trim().toLowerCase();
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

export async function requireTabAccess(requiredTab: string, department?: string) {
  const session = await auth();
  if (!session?.user) throw new Error("401 Unauthorized: Session expired or invalid.");

  const customUser = session.user as any;
  const sessionEmail = String(customUser.email || "").trim().toLowerCase();
  const isSuper = isSuperAdminEmail(sessionEmail);

  if (department) {
    const cleanDept = decodeURIComponent(department).trim().toLowerCase();
    
    // 🚀 Fetch and enforce organization status checks
    const org = await prisma.organization.findUnique({ 
      where: { subdomain: cleanDept }, 
      select: { id: true, status: true, name: true } 
    });
    
    if (!org) throw new Error(`Organization "${cleanDept}" not found.`);

    // 🚀 BLOCK INACTIVE OR ARCHIVED TENANTS (SuperAdmin bypasses this block)
    if (org.status && org.status !== 'Active' && !isSuper) {
      throw new Error(`This department is currently ${org.status.toLowerCase()} and cannot be accessed.`);
    }

    if (!isSuper) {
      const member = await prisma.tenantUser.findFirst({
        where: { organizationId: org.id, email: sessionEmail, status: "Active" },
      });
      if (!member) throw new Error("403 Forbidden: You do not belong to this organization.");
      customUser.role = member.role;
      customUser.allowedTabs = parseAllowedTabs(member.allowedTabs);
      customUser.name = member.fullName;
    }
  }

  const role = String(customUser.role || "viewer").trim().toLowerCase();
  const roleIsAdmin = ["admin", "administrator", "master", "superadmin", "super_admin"].includes(role);

  if (!isSuper && !roleIsAdmin) {
    const explicitTabs = parseAllowedTabs(customUser.allowedTabs);
    const effectiveTabs = explicitTabs.length > 0 ? explicitTabs : (PRESET_ROLE_TABS[role] || PRESET_ROLE_TABS.viewer);
    if (!effectiveTabs.includes(requiredTab)) {
      throw new Error(`403 Forbidden: Your account scope lacks permission for the ${requiredTab} module.`);
    }
  }

  return customUser;
}