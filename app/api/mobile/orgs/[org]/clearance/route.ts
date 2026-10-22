// Authenticated mobile clearance lookup; anonymous ID/email enumeration is denied.
// Students must first verify a code delivered to their own registered email.
// Officers may search a roster only with the live tab-clearance tenant permission.
import { ApiFailure, handler, preflight, publicBaseUrl } from '@/lib/mobile/http';
import { getOrgOr404 } from '@/lib/mobile/data';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { requireStudentClearanceSession } from '@/lib/mobile/student-clearance-auth';
import { toCentavos } from '@/lib/mobile/serialize';
import { clearanceVerifyPath, getStudentClearance } from '@/lib/clearance';

type Ctx = { params: Promise<{ org: string }> };

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const org = await getOrgOr404(slug);
  const query = new URL(req.url).searchParams.get('q')?.trim() || '';
  if (query.length > 120) throw new ApiFailure(400, 'invalid', 'That search is too long.');

  if (query) {
    // The presence of a school ID never grants public access: a fresh active
    // tenant officer session and tab-clearance entitlement are mandatory.
    await requireMobileOfficer(req, slug, 'tab-clearance');
    const result = await getStudentClearance(org.id, query, org.activeAy, org.activeTerm);
    if (!result) throw new ApiFailure(404, 'not_found', 'Student not found in this tenant.');
    const outstanding = result.unpaidItems.reduce((sum, i) => sum + toCentavos(i.balanceDue), 0);
    return {
      studentName: result.student.fullName,
      studentId: result.student.studentId,
      status: !result.isEnrolled ? 'not_enrolled' : result.isCleared ? 'cleared' : 'hold',
      outstandingCentavos: outstanding,
      unpaidItems: result.unpaidItems.map(i => ({
        label: i.itemDescription, amount: toCentavos(i.balanceDue),
        kind: i.category,
        ...(i.originAy ? { academicYear: i.originAy, term: i.originTerm } : {}),
      })),
      qrToken: result.signature
        ? publicBaseUrl(req) + clearanceVerifyPath(
            org.subdomain, org.activeAy, org.activeTerm,
            result.student.studentId, result.signature)
        : null,
      ay: org.activeAy, term: org.activeTerm,
    };
  }

  // Student tokens carry a server-validated tenant+student+academic-period.
  // Do not trust a student ID, email or period supplied by the device.
  const student = await requireStudentClearanceSession(req, org);
  const result = await getStudentClearance(org.id, student.studentId, org.activeAy, org.activeTerm);
  if (!result || result.student.id !== student.id) {
    throw new ApiFailure(401, 'unauthorized', 'Student clearance authorization has changed. Verify again.');
  }
  return {
    studentName: null,
    studentId: null,
    status: !result.isEnrolled ? 'not_enrolled' : result.isCleared ? 'cleared' : 'hold',
    outstandingCentavos: null,
    unpaidItems: null,
    // Public QR verification paths contain school IDs; do not leak them via
    // student-private API responses. A verified officer can issue the QR.
    qrToken: null,
    ay: org.activeAy, term: org.activeTerm,
  };
});

export const OPTIONS = preflight;
