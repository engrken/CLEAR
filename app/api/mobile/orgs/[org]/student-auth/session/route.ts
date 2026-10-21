import { handler, preflight } from '@/lib/mobile/http';
import { getOrgOr404 } from '@/lib/mobile/data';
import { getOwnStudentClearance, revokeStudentSession } from '@/lib/mobile/student-auth';
type Ctx = { params: Promise<{ org: string }> };
export const dynamic = 'force-dynamic';
export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  return getOwnStudentClearance(req, await getOrgOr404(slug));
});
export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  return revokeStudentSession(req, await getOrgOr404(slug));
});
export const OPTIONS = preflight;
