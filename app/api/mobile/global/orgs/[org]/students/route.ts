// Global superadmins can inspect any tenant roster; mutations are not exposed.
import { handler, preflight } from '@/lib/mobile/http';
import { requireGlobalMobileTenant } from '@/lib/mobile/global-tenant';
import { listStudents } from '@/lib/mobile/data';

type Ctx = { params: Promise<{ org: string }> };

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const { org } = await requireGlobalMobileTenant(req, slug);
  return listStudents(org, new URL(req.url).searchParams.get('q'));
});
export const OPTIONS = preflight;
