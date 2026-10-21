// Read-only pending proofs; global administrator cannot verify, invalidate or post receipts.
import { handler, preflight } from '@/lib/mobile/http';
import { requireGlobalMobileTenant } from '@/lib/mobile/global-tenant';
import { prisma } from '@/lib/prisma';
import { remittanceEntry } from '@/lib/mobile/data';

type Ctx = { params: Promise<{ org: string }> };

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const { org: slug } = await params;
  const { org } = await requireGlobalMobileTenant(req, slug);
  const proofs = await prisma.onlineRemittance.findMany({
    where: {
      organizationId: org.id,
      academicYear: org.activeAy,
      term: org.activeTerm,
      status: 'Pending Verification',
    },
    orderBy: { timestamp: 'desc' },
    take: 100,
  });
  return proofs.map(remittanceEntry);
});
export const OPTIONS = preflight;
