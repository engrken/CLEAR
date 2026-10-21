// Student-session revocation; never accepts an officer or global bearer token.
import { handler, preflight, json } from '@/lib/mobile/http';
import { revokeStudentClearanceSession } from '@/lib/mobile/student-clearance-auth';

export const DELETE = handler(async (req: Request) => {
  await revokeStudentClearanceSession(req);
  return json(req, null, 204);
});
export const OPTIONS = preflight;
