// lib/super-admin.ts  (NEW)  Fails closed: no SUPER_ADMIN_EMAIL means no Super Admin.
// NOTE: deliberately NOT 'server-only' yet, because your current Sidebar.tsx (a client component)
// still imports isSuperAdminEmail. On the client the env var is undefined, so it returns false and
// the sidebar falls back to the allowedTabs in the JWT (Super Admin gets all 15). Once Sidebar is
// fixed (PATCHES.md 2.3) you can add: import 'server-only';
export function isSuperAdminEmail(email?: string | null): boolean {
  const configured = String(process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!configured) {
    if (typeof window === 'undefined') {
      console.error('SUPER_ADMIN_EMAIL is not set; Super Admin access is disabled.');
    }
    return false;
  }
  const clean = String(email || '').trim().toLowerCase();
  return Boolean(clean) && clean === configured;
}
