// Strictly identity-only email update; no financial or tenant business writes.
import { handler, preflight, readJson, requireString } from '@/lib/mobile/http';
import { verifyCurrentOfficerCode } from '@/lib/email-rotation';
import { officerEmailScope } from '@/lib/email-rotation-context';

type Ctx = { params: Promise<{ org: string }> };
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const scope = await officerEmailScope(req, slug);
  const input = await readJson<{ code: string }>(req);
  return verifyCurrentOfficerCode(scope, requireString(input.code, 'Verification code', 12), req);
});
export const OPTIONS = preflight;
