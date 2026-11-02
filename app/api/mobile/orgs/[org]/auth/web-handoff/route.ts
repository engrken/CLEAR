import { ApiFailure, handler, preflight } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { issueWebHandoff, isWebHandoffEnabled } from '@/lib/mobile/web-handoff-issue';

type Ctx = { params: Promise<{ org: string }> };
export const POST = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const { officer, org, session } = await requireMobileOfficer(req, slug, []);
  if (!isWebHandoffEnabled()) throw new ApiFailure(503, 'unavailable', 'Secure browser sign-in is not yet enabled.');
  return issueWebHandoff({ principalType: 'officer', principalId: officer.id,
    organizationId: org.id, mobileSessionId: session.id, destination: `/department/${org.subdomain}` });
});
export const OPTIONS = preflight;
