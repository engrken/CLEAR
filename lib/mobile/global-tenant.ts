// Match the web's lib/permissions.ts superadmin tenant access semantics:
// verified global members may read any tenant, including inactive/archived ones.
// Do NOT exchange the global token for an officer session or infer tenant membership.
import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireGlobalMobileAdmin } from '@/lib/mobile/global-session';
import { ApiFailure } from '@/lib/mobile/http';
import { normalizeDepartmentSlug } from '@/lib/roles';

export async function requireGlobalMobileTenant(req: Request, slug: string) {
  // Every request rechecks the global admin registry and session version.
  const { identity } = await requireGlobalMobileAdmin(req);
  const normalized = normalizeDepartmentSlug(slug);
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) {
    throw new ApiFailure(404, 'not_found', 'Organization not found.');
  }
  const org = await prisma.organization.findUnique({
    where: { subdomain: normalized },
  });
  if (!org) throw new ApiFailure(404, 'not_found', 'Organization not found.');
  // Unlike a department officer, web Global Superadmin can inspect inactive
  // and archived organizations. The Android tenant endpoints remain GET-only.
  return { identity, org };
}
