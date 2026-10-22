// Strictly identity-only email update; no financial or tenant business writes.
import { handler, preflight, readJson, requireString } from '@/lib/mobile/http';
import { requestCurrentOfficerCode } from '@/lib/email-rotation';
import { officerEmailScope } from '@/lib/email-rotation-context';

type Ctx = { params: Promise<{ org: string }> };
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const scope = await officerEmailScope(req, slug);
  return requestCurrentOfficerCode(scope, req);
});
export const OPTIONS = preflight;
