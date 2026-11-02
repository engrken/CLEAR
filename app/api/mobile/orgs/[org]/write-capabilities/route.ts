import { handler, preflight } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { hasTabAccess } from '@/lib/roles';
import { canRunMobileRosterWrites } from '@/lib/mobile/production-readonly';

type Ctx = { params: Promise<{ org: string }> };

/**
 * Explicit authenticated capability response. This is intentionally deny-all
 * until audited server-side action authorization and transaction routes exist.
 * Never derive write privileges from allowedTabs or from an Android flag.
 */
export const GET = handler(async (req, { params }: Ctx) => {
  const { org } = await params;
  const { officer, org: tenant } = await requireMobileOfficer(req, org, []);
  const enabled = canRunMobileRosterWrites({
    vercelEnv: process.env.VERCEL_ENV,
    gitRef: process.env.VERCEL_GIT_COMMIT_REF,
    rosterWritesEnabled: process.env.MOBILE_STUDENT_ROSTER_WRITES_ENABLED === 'true',
  });
  if (!enabled || !hasTabAccess(officer.role, officer.allowedTabs, 'tab-students')) {
    return { enabled: false, grants: [] };
  }
  return {
    enabled: true,
    grants: ['students.create', 'students.update', 'students.enrollment'].map(action => ({
      action, organization: tenant.subdomain,
    })),
  };
});

export const OPTIONS = preflight;
