// lib/super-admin.ts

import 'server-only';
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
