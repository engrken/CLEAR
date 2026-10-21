// /lib/mobile/serialize.ts
//
// Maps database rows to the JSON shapes in the mobile API spec
// (mobile/src/api/types.ts). Money goes out as integer centavos.

import type { Organization, TenantUser } from '@prisma/client';
import { effectiveTabs } from '@/lib/roles';

export const toCentavos = (pesos: unknown) => Math.round((Number(pesos) || 0) * 100);
export const toPesos = (centavos: number) => Math.round(centavos) / 100;

export function toOrganization(org: Pick<Organization, 'subdomain' | 'name' | 'type' | 'logo' | 'activeAy' | 'activeTerm'>) {
  return {
    subdomain: org.subdomain,
    name: org.name,
    type: org.type === 'Organization' ? 'Organization' : 'Department',
    logoUrl: org.logo || null,
    activeAy: org.activeAy,
    activeTerm: org.activeTerm,
  };
}

export function toOfficer(user: Pick<TenantUser, 'id' | 'fullName' | 'email' | 'role' | 'allowedTabs'>) {
  // Preserve the actual database role label. Some tenant accounts have the
  // name 'superadmin' with explicit department tabs; they are NOT global admins.
  // Only lib/mobile/global-session.ts can issue global-mobile authorization.
  const role = String(user.role || 'viewer').trim().toLowerCase() || 'viewer';
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role,
    scope: 'department' as const,
    allowedTabs: effectiveTabs(user.role, user.allowedTabs),
  };
}
