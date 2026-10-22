import { handler, preflight, readJson, requireString } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { PRESENCE_TABS, normalizePresencePage } from '@/lib/collaboration-pages';
import { updatePagePresence, leavePagePresence } from '@/lib/collaboration-service';

type Ctx = { params: Promise<{ org: string }> };
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const body = await readJson<{ page: string; tabId: string }>(req);
  const page = normalizePresencePage(body.page);
  if (!page || !['overview','students','remittances'].includes(page)) return { colleagues: [], count: 0 };
  const { officer, org } = await requireMobileOfficer(req, slug, page === 'students' ? ['tab-students', 'tab-payment'] : PRESENCE_TABS[page]);
  if (String(officer.role).toLowerCase() === 'superadmin') return { colleagues: [], count: 0 };
  return updatePagePresence({
    organizationId: org.id, userId: officer.id, page, ay: org.activeAy, term: org.activeTerm,
    tabId: requireString(body.tabId, 'Presence tab ID', 50),
  });
});
export const DELETE = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const { officer, org } = await requireMobileOfficer(req, slug, null);
  const body = await readJson<{ tabId: string }>(req);
  await leavePagePresence(org.id, officer.id, requireString(body.tabId, 'Presence tab ID', 50));
  return { ok: true };
});
export const OPTIONS = preflight;
