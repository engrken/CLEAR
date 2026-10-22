import { handler, preflight } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { effectiveTabs } from '@/lib/roles';
import { getOnboardingState, completeOnboarding } from '@/lib/collaboration-service';

type Ctx = { params: Promise<{ org: string }> };
export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const { officer } = await requireMobileOfficer(req, slug, null);
  return getOnboardingState(officer.id, officer.role, effectiveTabs(officer.role, officer.allowedTabs));
});
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const { officer } = await requireMobileOfficer(req, slug, null);
  return completeOnboarding(officer.id, officer.role, effectiveTabs(officer.role, officer.allowedTabs));
});
export const OPTIONS = preflight;
