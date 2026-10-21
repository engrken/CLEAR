// Revokes a student-only short-lived token for exactly the issuing tenant.
import { handler, preflight, json } from '@/lib/mobile/http';
import { getOrgOr404 } from '@/lib/mobile/data';
import { revokeStudentClearanceSession } from '@/lib/mobile/student-clearance-auth';

type Ctx = { params: Promise<{ org: string }> };
export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const org = await getOrgOr404(slug);
  await revokeStudentClearanceSession(req, org);
  return json(req, null, 204);
});
export const OPTIONS = preflight;
