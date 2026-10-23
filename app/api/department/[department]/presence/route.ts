// Presence is tenant and module scoped. No student data or emails in the response.
import { NextResponse } from 'next/server';
import { requireTabAccess, requireTenantMember, requireOrgAdmin } from '@/lib/permissions';
import { PRESENCE_TABS, normalizePresencePage, presencePageKey } from '@/lib/collaboration-pages';
import { updatePagePresence, leavePagePresence } from '@/lib/collaboration-service';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ department: string }> };
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { department } = await params;
    const body = await req.json();
    const page = normalizePresencePage(body?.page);
    const ay = String(body?.ay ?? '');
    const term = String(body?.term ?? '');
    if (!page || !presencePageKey(page, ay, term) || typeof body?.tabId !== 'string')
      return json({ error: 'Invalid page' }, 400);
    const actor = page === 'logs'
      ? await requireOrgAdmin(department)
      : await requireTabAccess(PRESENCE_TABS[page], department);
    if (actor.isSuper || String(actor.role).toLowerCase() === 'superadmin') return json({ colleagues: [], count: 0 });
    const result = await updatePagePresence({
      organizationId: actor.organizationId, userId: actor.id,
      page, ay, term, tabId: body.tabId,
    });
    return json(result);
  } catch {
    return json({ error: 'Not authorized or presence unavailable' }, 403);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { department } = await params;
    const actor = await requireTenantMember(department);
    if (!actor.isSuper && String(actor.role).toLowerCase() !== 'superadmin') {
      const body = await req.json();
      if (typeof body?.tabId === 'string') await leavePagePresence(actor.organizationId, actor.id, body.tabId);
    }
    return json({ ok: true });
  } catch {
    return json({ error: 'Not authorized' }, 403);
  }
}
