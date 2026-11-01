import { ApiFailure, handler, preflight } from '@/lib/mobile/http';
import { requireGlobalMobileAdmin } from '@/lib/mobile/global-session';

/** Global sessions never exchange into tenant sessions. Ticket issuance remains disabled. */
export const POST = handler(async (req: Request) => {
  await requireGlobalMobileAdmin(req);
  throw new ApiFailure(503, 'unavailable', 'Secure Global Administrator browser handoff is not yet enabled. Sign in on the web portal.');
});

export const OPTIONS = preflight;
