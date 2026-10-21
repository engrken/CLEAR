import { ApiFailure, handler, preflight, readJson } from '@/lib/mobile/http';
import { getOrgOr404 } from '@/lib/mobile/data';
import { verifyStudentCode } from '@/lib/mobile/student-auth';
import { validStudentEmail } from '@/lib/mobile/student-policy';
type Ctx = { params: Promise<{ org: string }> };
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const body = await readJson<{ email: string; code: string }>(req);
  const email = validStudentEmail(body.email);
  if (!email || typeof body.code !== 'string' || !/^\d{6}$/.test(body.code)) {
    throw new ApiFailure(400, 'invalid_code', 'Invalid or expired verification code.');
  }
  return verifyStudentCode(req, await getOrgOr404(slug), email, body.code);
});
export const OPTIONS = preflight;
