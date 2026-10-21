import { handler, preflight, json } from '@/lib/mobile/http';
import { requireGlobalMobileAdmin, revokeGlobalMobileSession } from '@/lib/mobile/global-session';

export const GET = handler(async (req: Request) => {
  const { identity, session } = await requireGlobalMobileAdmin(req);
  return {
    admin: { id: identity.id, fullName: identity.fullName, email: identity.email, role: 'SuperAdmin' as const },
    expiresAt: session.expiresAt.toISOString(),
  };
});

export const DELETE = handler(async (req: Request) => {
  const { session } = await requireGlobalMobileAdmin(req);
  await revokeGlobalMobileSession(session.id);
  return json(req, null, 204);
});
export const OPTIONS = preflight;
