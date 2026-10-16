// POST /api/mobile/orgs/:org/auth/verify-code { email, code } -> Session
// Checks the code (lockout after 5 wrong tries) and issues a bearer token.

import { ApiFailure, handler, preflight, readJson, requireString } from '@/lib/mobile/http';
import { getOrgOr404 } from '@/lib/mobile/data';
import { createMobileSession } from '@/lib/mobile/session';
import { toOfficer, toOrganization } from '@/lib/mobile/serialize';
import { verifyDepartmentOtp } from '@/lib/otp';
import { logSystemAction } from '@/lib/logger';

type Ctx = { params: Promise<{ org: string }> };

export const POST = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const org = await getOrgOr404(slug);
  const body = await readJson<{ email: string; code: string }>(req);
  const email = requireString(body.email, 'Email', 254).toLowerCase();
  const code = requireString(body.code, 'Code', 12);
  if (!/^\d{6}$/.test(code)) throw new ApiFailure(400, 'invalid', 'The code is the 6 digits from the email.');

  const officer = await verifyDepartmentOtp(org, email, code);
  const { token, expiresAt } = await createMobileSession(officer, org, req.headers.get('user-agent'));
  await logSystemAction(org.id, officer.fullName, 'MOBILE_SIGN_IN', `Signed in on the mobile app (${officer.email}).`);

  return {
    token,
    officer: toOfficer(officer),
    org: toOrganization(org),
    expiresAt: expiresAt.toISOString(),
  };
});

export const OPTIONS = preflight;
