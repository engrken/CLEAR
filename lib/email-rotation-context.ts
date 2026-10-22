// Scope every identity mutation to a verified, still-live tenant session.
import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getOrgOr404 } from '@/lib/mobile/data';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { requireStudentClearanceSession } from '@/lib/mobile/student-clearance-auth';
import { ApiFailure } from '@/lib/mobile/http';

export async function officerEmailScope(req: Request, slug: string) {
  const { officer, org, session } = await requireMobileOfficer(req, slug, null);
  return {
    actor: 'officer' as const,
    orgId: org.id,
    accountId: officer.id,
    currentEmail: officer.email,
    sessionKey: session.id,
  };
}
export async function studentEmailScope(req: Request, slug: string) {
  const org = await getOrgOr404(slug);
  const verified = await requireStudentClearanceSession(req, org);
  const row = await prisma.student.findFirst({
    where: { id: verified.id, organizationId: org.id },
    select: { email: true },
  });
  if (!row?.email) throw new ApiFailure(401, 'unauthorized', 'Verify the registered student email again.');
  const bearer = req.headers.get('authorization') || '';
  return {
    actor: 'student' as const,
    orgId: org.id,
    accountId: verified.id,
    currentEmail: row.email,
    // The token is not persisted here, logged, or echoed back.
    sessionKey: crypto.createHash('sha256').update(bearer.replace(/^Bearer\s+/i, '')).digest('hex'),
  };
}
