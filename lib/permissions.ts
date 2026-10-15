import { auth } from "@/auth";

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
    } catch {
      return [];
    }
  }
  return [];
}

export async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("401 Unauthorized: Session expired or invalid.");
  }

  const user = session.user as any;
  const role = String(user.role || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  const sessionEmail = String(user.email || "").trim().toLowerCase();

  const isSuperRole = role === "superadmin" || role === "master" || role === "super_admin";

  if (!isSuperRole || !isSuperAdminEmail(sessionEmail)) {
    throw new Error("403 Forbidden: Super administrator privileges are required.");
  }

  return user;
}

export async function requireTabAccess(requiredTab: string) {
  const session = await auth();
  if (!session?.user) {
    throw new Error("401 Unauthorized: Session expired or invalid.");
  }

  const customUser = session.user as any;
  const sessionEmail = String(customUser.email || "").trim().toLowerCase();
  
  const role = String(customUser.role || "viewer").trim().toLowerCase();
  const roleIsAdmin = ["admin", "administrator", "master", "superadmin", "super admin", "super_admin"].includes(role);

  if (isSuperAdminEmail(sessionEmail) || roleIsAdmin) {
    return customUser; // Bypass tab restrictions for global/tenant admins
  }

  const allowedTabs = parseAllowedTabs(customUser.allowedTabs);

  if (!allowedTabs.includes(requiredTab)) {
    throw new Error(`403 Forbidden: Your account scope lacks permission for the ${requiredTab} module.`);
  }

  return customUser;
}