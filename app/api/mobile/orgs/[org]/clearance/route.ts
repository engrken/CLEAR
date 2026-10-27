// Authenticated mobile clearance lookup; anonymous ID/email enumeration is denied.
// Students must first verify a code delivered to their own registered email.
// Officers may search a roster only with the live tab-clearance tenant permission.
import { ApiFailure, handler, preflight, publicBaseUrl, json } from '@/lib/mobile/http';
import { getOrgOr404 } from '@/lib/mobile/data';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { requireStudentClearanceSession } from '@/lib/mobile/student-clearance-auth';
import { toCentavos } from '@/lib/mobile/serialize';
import { buildVerifiedStudentReasons } from '@/lib/student-clearance-reasons';
import { getStudentClearance } from '@/lib/clearance';
import { issueClearanceCertificate } from '@/lib/clearance-opaque-token';
import { prisma } from '@/lib/prisma';
import { isAcademicPeriodClosed } from '@/app/department/[department]/(protected)/realign/ledger';

type Ctx = { params: Promise<{ org: string }> };

export const dynamic = 'force-dynamic';

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const startedAt = performance.now();
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
      // Officer checks a QR presented by the OTP-verified student, never issues it.
      qrToken: null,
      ay: org.activeAy, term: org.activeTerm,
    };
  }

  // Student tokens carry a server-validated tenant+student+academic-period.
  // Do not trust a student ID, email or period supplied by the device.
  const student = await requireStudentClearanceSession(req, org);
  const authorizedAt = performance.now();
  const result = await getStudentClearance(org.id, student.studentId, org.activeAy, org.activeTerm, student);
  const calculatedAt = performance.now();
  if (!result || result.student.id !== student.id) {
    throw new ApiFailure(401, 'unauthorized', 'Student clearance authorization has changed. Verify again.');
  }
  // Only a verified student with no outstanding obligation in an open term
  // can receive an encrypted bearer certificate for presentation to an officer.
  const closed = result.isCleared
    ? await isAcademicPeriodClosed(prisma, org.id, org.activeAy, org.activeTerm)
    : true;
  const studentQrUrl = result.isCleared && !closed
    ? publicBaseUrl(req) + '/clearance/verify?token=' + encodeURIComponent(
        issueClearanceCertificate({
          orgId: org.id, studentPk: result.student.id, studentId: result.student.studentId,
          ay: org.activeAy, term: org.activeTerm,
        }))
    : null;
  // These explanations are disclosed ONLY after OTP session + own-record revalidation.
  // No transaction references, student identity, raw fine notes or receipt history.
  const holdReasons = result.isCleared
    ? []
    : buildVerifiedStudentReasons(result.isEnrolled, result.unpaidItems, toCentavos);
  // Server-Timing contains only durations, no account, OTP, QR or ledger data.
  const finishedAt = performance.now();
  const response = json(req, {
    studentName: null,
    studentId: null,
    status: !result.isEnrolled ? 'not_enrolled' : result.isCleared ? 'cleared' : 'hold',
    outstandingCentavos: null,
    unpaidItems: null,
    holdReasons,
    // Student identifier and balances remain private; URL contains opaque ciphertext.
    qrToken: studentQrUrl,
    ay: org.activeAy, term: org.activeTerm,
  });
  const ms = (value: number) => Math.max(0, value).toFixed(1);
  response.headers.set('Server-Timing', [
    `auth;dur=${ms(authorizedAt - startedAt)}`,
    `clearance;dur=${ms(calculatedAt - authorizedAt)}`,
    `certificate;dur=${ms(finishedAt - calculatedAt)}`,
    `total;dur=${ms(finishedAt - startedAt)}`,
  ].join(', '));
  return response;
});

export const OPTIONS = preflight;
