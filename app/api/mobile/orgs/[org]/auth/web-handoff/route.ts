import { ApiFailure, handler, preflight } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';

type Ctx = { params: Promise<{ org: string }> };

/** No handoff tickets are issued until atomic redemption and NextAuth exchange are verified. */
export const POST = handler(async (req, { params }: Ctx) => {
  const { org } = await params;
  await requireMobileOfficer(req, org, []);
  throw new ApiFailure(503, 'unavailable', 'Secure browser sign-in handoff is not yet enabled. Sign in on the web portal.');
});

export const OPTIONS = preflight;
