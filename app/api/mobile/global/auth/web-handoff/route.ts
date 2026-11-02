import { ApiFailure, handler, preflight, readJson } from '@/lib/mobile/http';
import { requireGlobalMobileAdmin } from '@/lib/mobile/global-session';
import { GLOBAL_WEB_PATHS, issueWebHandoff, isWebHandoffEnabled } from '@/lib/mobile/web-handoff-issue';

export const POST = handler(async (req) => {
  const { identity, session } = await requireGlobalMobileAdmin(req);
  if (!isWebHandoffEnabled()) throw new ApiFailure(503, 'unavailable', 'Secure browser sign-in is not yet enabled.');
  const body = await readJson<{ destination?: string }>(req);
  const destination = body.destination ?? '/dashboard/provisions';
  if (typeof destination !== 'string' || !GLOBAL_WEB_PATHS.has(destination))
    throw new ApiFailure(400, 'invalid', 'Unrecognized Global Administrator destination.');
  return issueWebHandoff({ principalType: 'global', principalId: identity.id,
    organizationId: null, mobileSessionId: session.id, destination });
});
export const OPTIONS = preflight;
