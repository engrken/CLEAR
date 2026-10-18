// GET    /api/mobile/orgs/:org/auth/session  -> { officer, org, expiresAt }
// DELETE /api/mobile/orgs/:org/auth/session  -> 204 (signs out: revokes the token)

import { handler, json, preflight } from '@/lib/mobile/http';
import { requireMobileOfficer, revokeMobileSession } from '@/lib/mobile/session';
import { toOfficer, toOrganization } from '@/lib/mobile/serialize';

type Ctx = { params: Promise<{ org: string }> };

export const GET = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const { officer, org, session } = await requireMobileOfficer(req, slug, null);
  return { officer: toOfficer(officer), org: toOrganization(org), expiresAt: session.expiresAt.toISOString() };
});

export const DELETE = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const { session } = await requireMobileOfficer(req, slug, null);
  await revokeMobileSession(session.id);
  return json(req, null, 204);
});

export const OPTIONS = preflight;
