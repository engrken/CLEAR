import { handler, preflight, readJson, requireString, ApiFailure } from '@/lib/mobile/http';
import { verifySuperAdminOtp } from '@/lib/super-admin-otp';
import { createGlobalMobileSession } from '@/lib/mobile/global-session';

export const POST = handler(async (req: Request) => {
  const body = await readJson<{ email: string; code: string }>(req);
  const email = requireString(body.email, 'Email', 254).toLowerCase();
  const code = requireString(body.code, 'Code', 12);
  if (!/^\\d{6}$/.test(code)) {
    throw new ApiFailure(400, 'invalid_code', 'Enter the six digits from your email.');
  }
  const verified = await verifySuperAdminOtp(email, code);
  if (!verified.ok) throw new ApiFailure(400, 'invalid_code', verified.message);
  const { token, expiresAt } = await createGlobalMobileSession(verified.identity, req.headers.get('user-agent'));
  return {
    token,
    admin: { id: verified.identity.id, email: verified.identity.email, fullName: verified.identity.fullName, role: 'SuperAdmin' as const },
    expiresAt: expiresAt.toISOString(),
  };
});
export const OPTIONS = preflight;
