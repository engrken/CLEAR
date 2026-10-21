// Global administrators use the web's canonical OTP policy, never department OTP.
import { handler, preflight, readJson, requireString } from '@/lib/mobile/http';
import { issueSuperAdminOtp } from '@/lib/super-admin-otp';

export const POST = handler(async (req: Request) => {
  const body = await readJson<{ email: string }>(req);
  const email = requireString(body.email, 'Email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { message: 'If this email is authorized, a verification code has been sent.' };
  }
  const result = await issueSuperAdminOtp(email);
  // Never reveal whether this global-admin account exists.
  return { message: result.message };
});
export const OPTIONS = preflight;
