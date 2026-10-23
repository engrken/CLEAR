// Strictly identity-only email update; no financial or tenant business writes.
import { handler, preflight, readJson, requireString } from '@/lib/mobile/http';
import { confirmNewEmail } from '@/lib/email-rotation';
import { studentEmailScope } from '@/lib/email-rotation-context';

type Ctx = { params: Promise<{ org: string }> };
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const scope = await studentEmailScope(req, slug);
  const input = await readJson<{ newEmail: string; code: string }>(req);
  return confirmNewEmail(scope, requireString(input.newEmail, 'New email', 254), requireString(input.code, 'Verification code', 12), req);
});
export const OPTIONS = preflight;
