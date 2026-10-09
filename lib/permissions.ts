import { auth } from "@/auth";

// =========================================================================
// HELPER
// =========================================================================
export function parseAllowedTabs(tabs: any): string[] {
  if (Array.isArray(tabs)) return tabs;
  if (typeof tabs === "string") {
    try {
      return JSON.parse(tabs);
    } catch {
      return [];
    }
  }
  return [];
}

// =========================================================================
// AUTHORIZATION GUARDS
// =========================================================================

export async function requireTabAccess(requiredTab: string) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("401 Unauthorized: Session expired or invalid.");
  }

  const customUser = session.user as any;
  const sessionEmail = String(customUser.email || "").trim().toLowerCase();
  
  // SUPER ADMIN & ROLE BYPASS
  const configuredSuperAdminEmail = String(process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
  const isMasterAdmin = sessionEmail === "kent.bsece@gmail.com" || (configuredSuperAdminEmail !== "" && sessionEmail === configuredSuperAdminEmail);
  
  const role = String(customUser.role || "").trim().toLowerCase();
  const roleIsAdmin = role === "admin" || role === "administrator" || role === "superadmin" || role === "super admin" || role === "super_admin";

  if (isMasterAdmin || roleIsAdmin) {
    return customUser; // Bypass restrictions for admins
  }

  const allowedTabs = parseAllowedTabs(customUser.allowedTabs);

  if (!allowedTabs.includes(requiredTab)) {
    throw new Error(`403 Forbidden: Your account scope lacks permission for the ${requiredTab} module.`);
  }

  return customUser;
}

export async function requireSuperAdmin() {
  const session = await auth();

  if (!session?.user) {
    throw new Error("401 Unauthorized: Session expired or invalid.");
  }

  const user = session.user as any;
  const role = String(user.role || "").trim().toLowerCase();
  const allowedTabs = parseAllowedTabs(user.allowedTabs);
  
  const configuredSuperAdminEmail = String(process.env.SUPER_ADMIN_EMAIL || "").trim().toLowerCase();
  const sessionEmail = String(user.email || "").trim().toLowerCase();

  const roleIsAdmin = role === "admin" || role === "administrator" || role === "superadmin" || role === "super admin" || role === "super_admin";
  const hasProvisionPermission = allowedTabs.includes("tab-provision");
  
  // Includes your master account explicitly
  const matchesConfiguredEmail = sessionEmail === "kent.bsece@gmail.com" || (configuredSuperAdminEmail !== "" && sessionEmail === configuredSuperAdminEmail);

  if (!roleIsAdmin && !hasProvisionPermission && !matchesConfiguredEmail) {
    throw new Error("403 Forbidden: Super administrator privileges are required.");
  }

  return user;
}