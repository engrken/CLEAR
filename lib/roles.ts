// /lib/roles.ts
//
// Role and permission-tab rules with no server dependencies, so client
// components can import them. Server-side guards live in lib/permissions.ts.

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

/** The tabs a member can use: their saved list, or their role's preset when none is saved. */
export function effectiveTabs(role: string | null | undefined, allowedTabs: unknown): string[] {
  if (isAdminRole(role)) return PRESET_ROLE_TABS.admin;
  const explicit = parseAllowedTabs(allowedTabs);
  if (explicit.length > 0) return explicit;
  const key = String(role || "viewer").trim().toLowerCase();
  return PRESET_ROLE_TABS[key] || PRESET_ROLE_TABS.viewer;
}

/** Tab rule shared by web sessions and mobile bearer tokens (admins pass in their own org). */
export function hasTabAccess(role: string | null | undefined, allowedTabs: unknown, requiredTab: string): boolean {
  return isAdminRole(role) || effectiveTabs(role, allowedTabs).includes(requiredTab);
}
