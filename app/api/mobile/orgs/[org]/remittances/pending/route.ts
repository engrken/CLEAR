// Read-only pending proof queue for the remittance permission.
// Never use the general ledger as a substitute: it requires tab-overview.
import { handler, preflight } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { prisma } from '@/lib/prisma';
import { remittanceEntry } from '@/lib/mobile/data';

type Ctx = { params: Promise<{ org: string }> };

export const GET = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const { org } = await requireMobileOfficer(req, slug, 'tab-remittances');
  const rows = await prisma.onlineRemittance.findMany({
    where: {
      organizationId: org.id,
      academicYear: org.activeAy,
      term: org.activeTerm,
      status: 'Pending Verification',
    },
    orderBy: { timestamp: 'desc' },
    take: 200,
  });
  return rows.map(remittanceEntry);
});

export const OPTIONS = preflight;
