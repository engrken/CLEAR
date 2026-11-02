// Safe, non-monetary academic calendar. Mirrors the web rule that existing
// financial/student records may not be stranded in an invalid term.
// An administrator's module access never substitutes for a server action grant.
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { academicYearStart, isCalendarMode, periodsFor } from '@/lib/academic-periods';
import { ApiFailure, handler, preflight, readJson } from '@/lib/mobile/http';
import { requireMobileOfficer } from '@/lib/mobile/session';
import { isAdminRole } from '@/lib/roles';
import { canRunMobileAcademicSettingsWrites, mobileTenantUserWriteEnvironment } from '@/lib/mobile/production-readonly';
type Ctx = { params: Promise<{ org: string }> };
export const dynamic = 'force-dynamic';
async function admin(req: Request, slug: string) {
  const context = await requireMobileOfficer(req, slug, 'tab-setup');
  if (!isAdminRole(context.officer.role)) {
    throw new ApiFailure(403, 'forbidden', 'Administrator permissions are required.');
  }
  return context;
}
export const GET = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const { org } = await admin(req, slug);
  const rows = await prisma.academicPeriodConfig.findMany({
    where: { organizationId: org.id },
    select: { academicYear: true, mode: true, includeSummer: true, updatedAt: true },
    orderBy: { academicYear: 'desc' }, take: 100,
  });
  return { activeAy: org.activeAy, activeTerm: org.activeTerm,
    configurations: rows.map(row => ({ academicYear: row.academicYear,
      mode: row.mode, includeSummer: row.includeSummer, updatedAt: row.updatedAt.toISOString() })) };
});
export const POST = handler(async (req, { params }: Ctx) => {
  const { org: slug } = await params;
  const { org, officer } = await admin(req, slug);
  if (!canRunMobileAcademicSettingsWrites(mobileTenantUserWriteEnvironment())) {
    throw new ApiFailure(403, 'read_only', 'Calendar editing has not been enabled for this deployment.');
  }
  const body = await readJson<{ academicYear: string; mode: string; includeSummer: boolean; expectedUpdatedAt: string | null }>(req);
  if (typeof body.academicYear !== 'string' || body.academicYear.length > 30 ||
      typeof body.mode !== 'string' || !isCalendarMode(body.mode) ||
      typeof body.includeSummer !== 'boolean' ||
      !(body.expectedUpdatedAt === null || typeof body.expectedUpdatedAt === 'string') ||
      !Object.prototype.hasOwnProperty.call(body, 'expectedUpdatedAt')) {
    throw new ApiFailure(400, 'invalid', 'Calendar settings are invalid.');
  }
  const ay=body.academicYear.trim();
  try { academicYearStart(ay); }
  catch { throw new ApiFailure(400, 'invalid', 'Use a valid academic year such as A.Y. 2026 - 2027.'); }
  const includeSummer=body.mode === 'Semester' && body.includeSummer;
  const allowed=periodsFor({mode:body.mode, includeSummer});
  const stamp=body.expectedUpdatedAt;
  if (stamp !== null && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(stamp) ||
      !Number.isFinite(Date.parse(stamp)) || new Date(stamp).toISOString() !== stamp)) {
    throw new ApiFailure(400, 'invalid', 'Refresh calendar before editing.');
  }
  try {
    return await prisma.$transaction(async tx => {
      const liveOrg=await tx.organization.findUnique({where:{id:org.id},
        select:{status:true,activeAy:true,activeTerm:true}});
      if (liveOrg?.status !== 'Active') throw new ApiFailure(403,'forbidden','Organization is not active.');
      if (liveOrg.activeAy === ay && !allowed.includes(liveOrg.activeTerm)) {
        // The web may migrate activeTerm under further safeguards. Mobile
        // refuses this financial-period transition rather than doing it implicitly.
        throw new ApiFailure(409,'conflict','The active term would become invalid. Use the audited web period-change workflow.');
      }
      const where={ organizationId:org.id, academicYear:ay };
      const [funds, fees, receipts, dues, fines, advances, liquidations, cashier, remittances, enrollments, transfers]=await Promise.all([
        tx.fund.findMany({where,select:{term:true}}),
        tx.collectionSetup.findMany({where,select:{term:true}}),
        tx.collection.findMany({where,select:{term:true}}),
        tx.collectible.findMany({where,select:{term:true}}),
        tx.penalty.findMany({where,select:{term:true}}),
        tx.cashAdvance.findMany({where,select:{term:true}}),
        tx.audit.findMany({where,select:{term:true}}),
        tx.cashierRemittance.findMany({where,select:{term:true}}),
        tx.onlineRemittance.findMany({where,select:{term:true}}),
        tx.enrollment.findMany({where,select:{term:true}}),
        tx.fundTransfer.findMany({where,select:{term:true}}),
      ]);
      const invalid=[...new Set([funds,fees,receipts,dues,fines,advances,liquidations,cashier,remittances,enrollments,transfers]
        .flat().map(record=>record.term))].filter(term=>!allowed.includes(term));
      if (invalid.length) throw new ApiFailure(409,'conflict',
        'Existing accounting, assessment or enrollment records use a term not present in this calendar. Use secure web.');
      const key={organizationId_academicYear:{organizationId:org.id,academicYear:ay}};
      const previous=await tx.academicPeriodConfig.findUnique({where:key});
      if ((previous?.updatedAt.toISOString() ?? null) !== stamp) {
        throw new ApiFailure(409,'conflict','Calendar changed since you opened it. Refresh and retry.');
      }
      await tx.academicPeriodConfig.upsert({
        where:key, create:{ organizationId:org.id,academicYear:ay,mode:body.mode!,includeSummer },
        update:{ mode:body.mode!,includeSummer },
      });
      await tx.systemLog.create({ data: {
        organizationId:org.id,user:officer.email,action:'ACADEMIC_CALENDAR_UPDATE',
        details:ay+': '+(previous?.mode ?? 'Legacy')+' => '+body.mode+'; Summer:'+includeSummer,
      }});
      return {success:true};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  } catch (error) {
    if ((error as {code?:string})?.code === 'P2034') {
      throw new ApiFailure(409,'conflict','Concurrent academic settings update. Refresh and retry.');
    }
    throw error;
  }
});
export const OPTIONS = preflight;
