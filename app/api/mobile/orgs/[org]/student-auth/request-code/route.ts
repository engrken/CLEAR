import { ApiFailure, handler, preflight, readJson } from '@/lib/mobile/http';
import { getOrgOr404 } from '@/lib/mobile/data';
import { requestStudentCode } from '@/lib/mobile/student-auth';
import { validStudentEmail } from '@/lib/mobile/student-policy';
type Ctx = { params: Promise<{ org: string }> };
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const body = await readJson<{ email: string }>(req);
  const email = validStudentEmail(body.email);
  if (!email) throw new ApiFailure(400, 'invalid', 'Enter a valid email address.');
  return requestStudentCode(req, await getOrgOr404(slug), email);
});
export const OPTIONS = preflight;
