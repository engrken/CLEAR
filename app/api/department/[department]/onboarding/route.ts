// Versioned role-specific onboarding belongs to authenticated tenant officers.
import { NextResponse } from 'next/server';
import { requireTenantMember } from '@/lib/permissions';
import { effectiveTabs } from '@/lib/roles';
import { getOnboardingState, completeOnboarding } from '@/lib/collaboration-service';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ department: string }> };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { department } = await params;
    const actor = await requireTenantMember(department);
    if (actor.isSuper || String(actor.role).toLowerCase() === 'superadmin')
      return json({ exempt: true, completed: true, tabs: [] });
    return json(await getOnboardingState(actor.id, actor.role, effectiveTabs(actor.role, JSON.stringify(actor.allowedTabs))));
  } catch { return json({ error: 'Not authorized or onboarding unavailable' }, 403); }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const contentType = req.headers.get('content-type') || '';
    const origin = req.headers.get('origin');
    // Cookie-authenticated metadata writes need a same-origin JSON request.
    if (!contentType.toLowerCase().startsWith('application/json')) return json({ error: 'JSON required' }, 415);
    if (origin && origin !== new URL(req.url).origin) return json({ error: 'Cross-origin request denied' }, 403);
    const { department } = await params;
    const actor = await requireTenantMember(department);
    if (actor.isSuper || String(actor.role).toLowerCase() === 'superadmin')
      return json({ exempt: true, completed: true });
    return json(await completeOnboarding(actor.id, actor.role, effectiveTabs(actor.role, JSON.stringify(actor.allowedTabs))));
  } catch { return json({ error: 'Not authorized or onboarding unavailable' }, 403); }
}
