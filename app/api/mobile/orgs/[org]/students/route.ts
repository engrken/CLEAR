// GET /api/mobile/orgs/:org/students?q=: roster with active-term enrollment status.
// Treasurers need it to record payments, so tab-payment grants it too.

import { ApiFailure, handler, preflight } from '@/lib/mobile/http';
import { listStudents } from '@/lib/mobile/data';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { hasTabAccess } from '@/lib/roles';

type Ctx = { params: Promise<{ org: string }> };

export const GET = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const search = new URL(req.url).searchParams;
  const emailMode = search.get('email');
  if (emailMode !== null && emailMode !== 'missing') {
    throw new ApiFailure(400, 'invalid', 'Unknown roster email filter.');
  }
  const missingEmailOnly = emailMode === 'missing';
  // Receipt officers may view the general roster, but missing-email
  // remediation requires the more specific Students permission.
  const { org, officer } = await requireMobileOfficer(req, slug,
    missingEmailOnly ? 'tab-students' : ['tab-students', 'tab-payment']);
  return listStudents(org, search.get('q'), missingEmailOnly,
    hasTabAccess(officer.role, officer.allowedTabs, 'tab-students'));

});

export const OPTIONS = preflight;
