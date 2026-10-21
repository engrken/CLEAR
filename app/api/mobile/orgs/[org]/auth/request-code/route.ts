// POST /api/mobile/orgs/:org/auth/request-code { email }
// Emails a 6-digit sign-in code to an active officer, using the web's own OTP rules
// (lib/department-otp.ts). The reply is the same whether or not the account exists.

import { handler, preflight, readJson, requireString } from '@/lib/mobile/http';
import { getOrgOr404 } from '@/lib/mobile/data';
import { requestMobileCode } from '@/lib/mobile/otp';

type Ctx = { params: Promise<{ org: string }> };

export const POST = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const org = await getOrgOr404(slug);
  const body = await readJson<{ email: string }>(req);
  const email = requireString(body.email, 'Email', 254).toLowerCase();

  return requestMobileCode(org, email);
});

export const OPTIONS = preflight;
