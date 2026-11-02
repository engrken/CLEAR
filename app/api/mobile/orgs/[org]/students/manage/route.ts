import { ApiFailure, handler, preflight, readJson } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { applyMobileRosterChange, type RosterInput } from '@/lib/mobile/student-roster-write';
import { canRunMobileRosterWrites } from '@/lib/mobile/production-readonly';

type Ctx = { params: Promise<{ org: string }> };

/** Authenticated and independently feature-gated roster mutations only. */
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  if (!canRunMobileRosterWrites({
    vercelEnv: process.env.VERCEL_ENV,
    gitRef: process.env.VERCEL_GIT_COMMIT_REF,
    rosterWritesEnabled: process.env.MOBILE_STUDENT_ROSTER_WRITES_ENABLED === 'true',
  })) throw new ApiFailure(403, 'read_only', 'Student roster editing is disabled on this server.');
  const { org, officer } = await requireMobileOfficer(req, slug, 'tab-students');
  const body = await readJson<Record<string, unknown>>(req);
  if (!['create', 'update', 'enrollment'].includes(String(body.action || ''))) {
    throw new ApiFailure(400, 'invalid', 'Unsupported student roster action.');
  }
  // No academic period, organization or officer identifier is accepted from the app.
  return applyMobileRosterChange(org, officer, body as RosterInput);
});
export const OPTIONS = preflight;
