import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireTenantMember } from '@/lib/permissions';
import { PRESET_ROLE_TABS } from '@/lib/role-permissions';

const ADMIN = new Set(['admin', 'administrator', 'master']);
const REPORT_TABS = ['tab-payment', 'tab-reports', 'tab-report'];
export type AiAccess = Awaited<ReturnType<typeof requireAiAccess>>;

export async function requireAiAccess(department: string) {
  const officer = await requireTenantMember(department);
  const organization = await prisma.organization.findUnique({
    where: { id: officer.organizationId },
    select: { id: true, name: true, tier: true, status: true, activeAy: true, activeTerm: true },
  });
  if (!organization || organization.status !== 'Active') {
    throw new Error('403: The organization is not active.');
  }
  // Both checks are server-side: a forged client flag cannot unlock Gemini.
  if (organization.tier !== 'Pro' && organization.tier !== 'Corporate') {
    throw new Error('402: CLEAR AI is available on Pro and Corporate plans.');
  }
  const role = String(officer.role || '').trim().toLowerCase();
  const admin = officer.isSuper || ADMIN.has(role);
  const permissions = admin
    ? PRESET_ROLE_TABS.admin
    : (officer.allowedTabs.length ? officer.allowedTabs : (PRESET_ROLE_TABS[role] || PRESET_ROLE_TABS.viewer));
  return { officer, organization, permissions, admin };
}

/** Deliberately return aggregate values only; no student identities or receipts enter the prompt. */
export async function authorizedAiSnapshot(access: AiAccess) {
  const { organization: org, permissions } = access;
  const where = { organizationId: org.id, academicYear: org.activeAy, term: org.activeTerm };
  const snapshot: Record<string, unknown> = {
    organization: org.name,
    academicYear: org.activeAy,
    term: org.activeTerm,
  };
  if (REPORT_TABS.some(tab => permissions.includes(tab))) {
    const result = await prisma.collection.aggregate({
      where: { ...where, status: 'Valid' },
      _sum: { amountPaid: true },
      _count: { id: true },
    });
    snapshot.validCollectionEntries = result._count.id;
    snapshot.validCollectionsPhp = result._sum.amountPaid?.toFixed(2) || '0.00';
  }
  if (permissions.includes('tab-audit')) {
    const result = await prisma.audit.aggregate({
      where,
      _count: { id: true },
      _sum: { totalExpense: true },
    });
    snapshot.liquidationRecords = result._count.id;
    snapshot.liquidationExpensesPhp = result._sum.totalExpense?.toFixed(2) || '0.00';
  }
  if (permissions.includes('tab-advances')) {
    const result = await prisma.cashAdvance.aggregate({
      where,
      _count: { id: true },
      _sum: { amountApproved: true },
    });
    snapshot.cashAdvanceRecords = result._count.id;
    snapshot.cashAdvanceApprovedPhp = result._sum.amountApproved?.toFixed(2) || '0.00';
  }
  return snapshot;
}
