import { ApiFailure, handler, preflight } from '@/lib/mobile/http';
import { requireGlobalMobileAdmin } from '@/lib/mobile/global-session';
import { issueWebHandoff, isWebHandoffEnabled } from '@/lib/mobile/web-handoff-issue';

export const POST = handler(async (req) => {
  const { identity, session } = await requireGlobalMobileAdmin(req);
  if (!isWebHandoffEnabled()) throw new ApiFailure(503, 'unavailable', 'Secure browser sign-in is not yet enabled.');
  return issueWebHandoff({ principalType: 'global', principalId: identity.id,
    organizationId: null, mobileSessionId: session.id, destination: '/dashboard/provisions' });
});
export const OPTIONS = preflight;
