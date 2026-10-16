// /lib/mobile/serialize.ts
//
// Maps database rows to the JSON shapes in the mobile API spec
// (mobile/src/api/types.ts). Money goes out as integer centavos.

import type { Organization, TenantUser } from '@prisma/client';
import { effectiveTabs } from '@/lib/permissions';

export const toCentavos = (pesos: unknown) => Math.round((Number(pesos) || 0) * 100);
export const toPesos = (centavos: number) => Math.round(centavos) / 100;

const ROLES = new Set(['admin', 'treasurer', 'auditor', 'viewer']);

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
  const raw = String(user.role || '').trim().toLowerCase();
  const role = ['master', 'administrator'].includes(raw) ? 'admin' : ROLES.has(raw) ? raw : 'viewer';
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    role,
    allowedTabs: effectiveTabs(user.role, user.allowedTabs),
  };
}
