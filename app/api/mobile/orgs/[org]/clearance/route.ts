// GET /api/mobile/orgs/:org/clearance?q=<school ID or email>
// Public: cleared / on hold plus the QR verification URL. The outstanding amount
// is only included for an officer token with tab-clearance (policy F54).

import { ApiFailure, handler, preflight, publicBaseUrl } from '@/lib/mobile/http';
import { getOrgOr404 } from '@/lib/mobile/data';
import { optionalMobileOfficer } from '@/lib/mobile/session';
import { toCentavos } from '@/lib/mobile/serialize';
import { clearanceVerifyPath, getStudentClearance } from '@/lib/clearance';

type Ctx = { params: Promise<{ org: string }> };

export const GET = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const org = await getOrgOr404(slug);

  const q = new URL(req.url).searchParams.get('q')?.trim() || '';
  if (!q) throw new ApiFailure(400, 'invalid', 'Enter a student ID or email.');
  if (q.length > 120) throw new ApiFailure(400, 'invalid', 'That search is too long.');

  const result = await getStudentClearance(org.id, q, org.activeAy, org.activeTerm);
  if (!result) {
    throw new ApiFailure(404, 'not_found', 'No student with that ID or email is on this department’s roster.');
  }

  const officer = await optionalMobileOfficer(req, slug, 'tab-clearance');
  const outstanding = result.unpaidItems.reduce((sum, i) => sum + toCentavos(i.balanceDue), 0);

  return {
    studentName: result.student.fullName,
    studentId: result.student.studentId,
    status: result.isCleared ? 'cleared' : 'hold',
    outstandingCentavos: officer ? outstanding : null,
    qrToken: result.signature
      ? publicBaseUrl(req) +
        clearanceVerifyPath(org.subdomain, org.activeAy, org.activeTerm, result.student.studentId, result.signature)
      : null,
    ay: org.activeAy,
    term: org.activeTerm,
  };
});

export const OPTIONS = preflight;
