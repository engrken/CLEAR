// Public metadata-only OTP request. Never returns account existence.
import { handler, preflight, readJson, requireString } from '@/lib/mobile/http';
import { getOrgOr404 } from '@/lib/mobile/data';
import { requestStudentClearanceCode } from '@/lib/mobile/student-clearance-auth';

type Ctx = { params: Promise<{ org: string }> };
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const org = await getOrgOr404(slug);
  const body = await readJson<{ studentId: string; email: string }>(req);
  return requestStudentClearanceCode(
    org, requireString(body.studentId, 'Student ID', 80),
    requireString(body.email, 'Registered email', 254), req
  );
});
export const OPTIONS = preflight;
