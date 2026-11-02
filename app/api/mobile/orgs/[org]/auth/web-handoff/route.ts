import { ApiFailure, handler, preflight, readJson } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { issueWebHandoff, isWebHandoffEnabled, OFFICER_WEB_PATHS } from '@/lib/mobile/web-handoff-issue';

type Ctx = { params: Promise<{ org: string }> };
export const POST = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const { officer, org, session } = await requireMobileOfficer(req, slug, []);
  if (!isWebHandoffEnabled()) throw new ApiFailure(503, 'unavailable', 'Secure browser sign-in is not yet enabled.');
  const body = await readJson<{ webPath?: string }>(req);
  const webPath = body.webPath ?? '';
  if (typeof webPath !== 'string' || (webPath && !OFFICER_WEB_PATHS.has(webPath)))
    throw new ApiFailure(400, 'invalid', 'Unrecognized secure web module.');
  return issueWebHandoff({ principalType: 'officer', principalId: officer.id,
    organizationId: org.id, mobileSessionId: session.id, destination: `/department/${org.subdomain}${webPath}` });
});
export const OPTIONS = preflight;
