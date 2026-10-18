// GET /api/mobile/orgs/:org/students?q=: roster with active-term enrollment status.
// Treasurers need it to record payments, so tab-payment grants it too.

import { handler, preflight } from '@/lib/mobile/http';
import { listStudents } from '@/lib/mobile/data';
import { requireMobileOfficer } from '@/lib/mobile/session';

type Ctx = { params: Promise<{ org: string }> };

export const GET = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const { org } = await requireMobileOfficer(req, slug, ['tab-students', 'tab-payment']);
  return listStudents(org, new URL(req.url).searchParams.get('q'));
});

export const OPTIONS = preflight;
