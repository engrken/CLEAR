import { handler, preflight } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';

type Ctx = { params: Promise<{ org: string }> };

/**
 * Explicit authenticated capability response. This is intentionally deny-all
 * until audited server-side action authorization and transaction routes exist.
 * Never derive write privileges from allowedTabs or from an Android flag.
 */
export const GET = handler(async (req, { params }: Ctx) => {
  const { org } = await params;
  await requireMobileOfficer(req, org, []);
  return {
    enabled: false,
    grants: [],
  };
});

export const OPTIONS = preflight;
