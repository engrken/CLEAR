// /lib/roles.ts
//
// Tab-permission rules for mobile bearer tokens, built on lib/role-permissions.ts
// so they match the web guard in lib/permissions.ts (requireTabAccess):
// admins (admin/administrator/master) get every tab; others get their saved
// tabs, or their role's preset when none are saved. No server dependencies.

import { PRESET_ROLE_TABS, parseAllowedTabs } from '@/lib/role-permissions';

export { PRESET_ROLE_TABS, parseAllowedTabs };

const ADMIN_ROLES = new Set(['admin', 'administrator', 'master']);

export function normalizeDepartmentSlug(department: string): string {
  let raw = String(department || '');
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Malformed escape sequence: fall through with the raw value (it will not match a subdomain)
  }
  return raw.trim().toLowerCase();
}

export function isAdminRole(role?: string | null): boolean {
  return ADMIN_ROLES.has(String(role || '').trim().toLowerCase());
}

/** The tabs a member can use: their saved list, or their role's preset when none is saved. */
export function effectiveTabs(role: string | null | undefined, allowedTabs: unknown): string[] {
  if (isAdminRole(role)) return PRESET_ROLE_TABS.admin;
  const explicit = parseAllowedTabs(allowedTabs);
  if (explicit.length > 0) return explicit;
  const key = String(role || 'viewer').trim().toLowerCase();
  return PRESET_ROLE_TABS[key] || PRESET_ROLE_TABS.viewer;
}

/** Same rule as requireTabAccess on the web. */
export function hasTabAccess(role: string | null | undefined, allowedTabs: unknown, requiredTab: string): boolean {
  return isAdminRole(role) || effectiveTabs(role, allowedTabs).includes(requiredTab);
}

/** Organization lifecycle (Organization.status). Only Active ones are usable by tenants. */
export function isOrganizationActive(org: { status?: string | null }): boolean {
  return String(org.status ?? '').toLowerCase() === 'active';
}
