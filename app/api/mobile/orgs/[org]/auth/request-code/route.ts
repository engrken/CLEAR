// POST /api/mobile/orgs/:org/auth/request-code { email }
// Emails a 6-digit sign-in code to an active officer (same rules as the web login).

import { handler, preflight, readJson, requireString } from '@/lib/mobile/http';
import { getOrgOr404 } from '@/lib/mobile/data';
import { sendDepartmentOtp } from '@/lib/otp';

type Ctx = { params: Promise<{ org: string }> };

export const POST = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const org = await getOrgOr404(slug);
  const body = await readJson<{ email: string }>(req);
  const email = requireString(body.email, 'Email', 254).toLowerCase();

  const { user } = await sendDepartmentOtp(org, email);
  return { sentTo: user.email };
});

export const OPTIONS = preflight;
