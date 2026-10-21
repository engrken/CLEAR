// GET /api/mobile/orgs/:org/remittances/:id — read-only proof details.
// Authorization is based on tab-remittances, not the broader treasury overview.
import { handler, preflight, ApiFailure } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { prisma } from '@/lib/prisma';
import { remittanceEntry } from '@/lib/mobile/data';

type Ctx = { params: Promise<{ org: string; id: string }> };

export const GET = handler(async (req, { params }: Ctx) => {
  const { org: slug, id } = await params;
  const { org } = await requireMobileOfficer(req, slug, 'tab-remittances');
  if (!id || id.length > 120) throw new ApiFailure(400, 'invalid', 'Invalid remittance identifier.');
  const proof = await prisma.onlineRemittance.findFirst({
    where: { id, organizationId: org.id, academicYear: org.activeAy, term: org.activeTerm },
  });
  if (!proof) throw new ApiFailure(404, 'not_found', 'The remittance was not found in this department.');
  // Serve only bounded embedded images. Do not turn arbitrary stored URLs into
  // authenticated SSRF/proxy targets or expose an untrusted URI to the APK.
  const image = String(proof.proofUrl ?? '');
  const proofDataUrl = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i.test(image) && image.length <= 1_400_000
    ? image
    : null;
  return {
    ...remittanceEntry(proof),
    studentId: proof.studentId || '',
    studentEmail: proof.studentEmail || null,
    paymentChannel: proof.paymentChannel,
    itemDescription: proof.itemDescription,
    proofDataUrl,
    reviewNotes: proof.reviewNotes || null,
    reviewedBy: proof.reviewedBy || null,
  };
});

export const OPTIONS = preflight;
