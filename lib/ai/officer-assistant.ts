import 'server-only';
import { prisma } from '@/lib/prisma';
import { requireTenantMember } from '@/lib/permissions';
import { PRESET_ROLE_TABS } from '@/lib/role-permissions';
import { canUseAiAsTenantOfficer, canUseAiRollout, isAiPaidTier } from '@/lib/ai/policy';

const ADMIN = new Set(['admin', 'administrator', 'master']);
const REPORT_TABS = ['tab-payment', 'tab-reports', 'tab-report'];
export type AiAccess = Awaited<ReturnType<typeof requireAiAccess>>;

export async function requireAiAccess(department: string) {
  const officer = await requireTenantMember(department);
  if (!canUseAiAsTenantOfficer(officer.isSuper)) {
    throw new Error('403: Only tenant officer accounts may access CLEAR AI.');
  }
  const organization = await prisma.organization.findUnique({
    where: { id: officer.organizationId },
    select: { id: true, name: true, subdomain: true, tier: true, status: true, activeAy: true, activeTerm: true },
  });
  if (!organization || organization.status !== 'Active') {
    throw new Error('403: The organization is not active.');
  }
  // Both checks are server-side: a forged client flag cannot unlock Gemini.
  if (!isAiPaidTier(organization.tier)) {
    throw new Error('402: CLEAR AI is available on Pro and Corporate plans.');
  }
  if (!canUseAiRollout(
    organization.subdomain,
    officer.email,
    process.env.CLEAR_AI_ALLOWED_OFFICERS,
    process.env.CLEAR_AI_ROLLOUT_MODE,
  )) {
    throw new Error('403: CLEAR AI is not yet enabled for this officer.');
  }
  const role = String(officer.role || '').trim().toLowerCase();
  const admin = ADMIN.has(role);
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
    organization: 'Current organization',
    academicYear: org.activeAy,
    term: org.activeTerm,
  };
  if (REPORT_TABS.some(tab => permissions.includes(tab))) {
    const result = await prisma.collection.aggregate({
      where: { ...where, status: 'Valid' },
      _sum: { amountPaid: true },
      _count: { id: true },
    });
    snapshot.validCollectionAllocationRows = result._count.id;
    snapshot.sumOfValidCollectionRowsPhp = result._sum.amountPaid?.toFixed(2) || '0.00';
    snapshot.collectionMeaning = 'Sum of valid Collection.amountPaid allocation rows, not a bank or fund balance; verify with the official collections report.';
  }
  if (permissions.includes('tab-audit')) {
    const result = await prisma.audit.aggregate({
      where,
      _count: { id: true },
      _sum: { totalExpense: true },
    });
    snapshot.liquidationRecords = result._count.id;
    snapshot.liquidationExpensesPhp = result._sum.totalExpense?.toFixed(2) || '0.00';
    snapshot.auditMeaning = 'Sum of Audit.totalExpense across recorded audits; does not certify or approve an audit.';
  }
  if (permissions.includes('tab-advances')) {
    const result = await prisma.cashAdvance.aggregate({
      where,
      _count: { id: true },
      _sum: { amountApproved: true },
    });
    snapshot.cashAdvanceRecords = result._count.id;
    snapshot.cashAdvanceApprovedPhp = result._sum.amountApproved?.toFixed(2) || '0.00';
    snapshot.cashAdvanceMeaning = 'Sum of CashAdvance.amountApproved over records of all statuses; not an outstanding balance.';
  }
  return snapshot;
}
