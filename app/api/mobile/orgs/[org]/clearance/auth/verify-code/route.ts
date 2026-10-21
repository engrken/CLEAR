// Exchange a single-use, 5-minute code for a 10-minute student-only credential.
import { handler, preflight, readJson, requireString } from '@/lib/mobile/http';
import { getOrgOr404 } from '@/lib/mobile/data';
import { verifyStudentClearanceCode } from '@/lib/mobile/student-clearance-auth';

type Ctx = { params: Promise<{ org: string }> };
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const org = await getOrgOr404(slug);
  const body = await readJson<{ studentId: string; email: string; code: string }>(req);
  return verifyStudentClearanceCode(
    org, requireString(body.studentId, 'Student ID', 80),
    requireString(body.email, 'Registered email', 254),
    requireString(body.code, 'Verification code', 12), req
  );
});
export const OPTIONS = preflight;
