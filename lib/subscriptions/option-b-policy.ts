/**
 * CLEAR SaaS Option B — standalone, SIDE-EFFECT-FREE subscription policy.
 *
 * This module does not issue invoices, verify bank credits, grant entitlements
 * or change a tenant's status by itself. All actual invoice approval and
 * renewal must occur in one audited, tenant-scoped serializable DB transaction
 * after an independent Global Administrator bank-credit reconciliation.
 */
export type Tier = 'Freemium' | 'Pro' | 'Corporate';
export type SubscriptionAccess = 'CURRENT' | 'GRACE' | 'SUSPENDED' | 'UNVERIFIED';
export type OperationalMode = 'NORMAL' | 'READ_ONLY';
export type SubscriptionAssessment = Readonly<{
  access: SubscriptionAccess;
  operationalMode: OperationalMode;
  daysPastDue: number;
  studentClearanceReadable: true;
}>;

function parseInstant(value: string | Date): Date {
  if (typeof value === 'string' && !/(?:Z|[+-][0-9]{2}:[0-9]{2})$/i.test(value)) {
    throw new Error('Subscription timestamps must contain an explicit timezone.');
  }
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid subscription timestamp.');
  return date;
}

function manilaCalendarDay(date: string | Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(parseInstant(date));
  const field = (name: string) => Number(parts.find(p => p.type === name)?.value);
  const year = field('year'), month = field('month'), day = field('day');
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

/** Seven FULL Manila calendar days after a due date; suspend on day eight. */
export function assessSubscriptionAccess(input: {
  tier: Tier;
  paidThrough: string | Date | null;
  now: string | Date;
}): SubscriptionAssessment {
  if (!['Freemium', 'Pro', 'Corporate'].includes(input.tier)) {
    throw new Error('Unrecognized subscription tier.');
  }
  if (input.tier === 'Freemium') {
    return { access: 'CURRENT', operationalMode: 'NORMAL',
      daysPastDue: 0, studentClearanceReadable: true };
  }
  if (!input.paidThrough) {
    // No verifiable paid entitlement must never become a paid subscription.
    return { access: 'UNVERIFIED', operationalMode: 'READ_ONLY',
      daysPastDue: 0, studentClearanceReadable: true };
  }
  const daysPastDue = Math.max(0,
    manilaCalendarDay(input.now) - manilaCalendarDay(input.paidThrough));
  const access = daysPastDue === 0 ? 'CURRENT'
    : daysPastDue <= 7 ? 'GRACE' : 'SUSPENDED';
  return { access, operationalMode: access === 'SUSPENDED' ? 'READ_ONLY' : 'NORMAL',
    daysPastDue, studentClearanceReadable: true };
}

/**
 * Approval preconditions only. NEVER take this boolean from a student/payer
 * request; it must come from authenticated Global Administrator review of a
 * real credited bank statement, not a screenshot or submitted reference.
 */
export function validateManualInstaPayApproval(input: {
  invoiceId: string;
  invoiceStatus: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED';
  expectedCentavos: bigint;
  receivedCentavos: bigint;
  bankCreditIndependentlyVerified: boolean;
  bankReference: string;
  receivingAccountId: string;
  reviewerId: string;
  payerId: string;
}): Readonly<{ uniqueApprovalKey: string; receivedCentavos: bigint }> {
  if (input.invoiceStatus !== 'PENDING_VERIFICATION') {
    throw new Error('Only a pending invoice can be verified.');
  }
  if (!input.bankCreditIndependentlyVerified) {
    throw new Error('A payment screenshot or payer reference is not bank-credit verification.');
  }
  if (!input.invoiceId || input.invoiceId.length > 128 ||
      !/^[A-Za-z0-9_-]{2,80}$/.test(input.receivingAccountId) ||
      !input.reviewerId || !input.payerId ||
      input.reviewerId === input.payerId) {
    throw new Error('A separate authorized Global Administrator must verify the payment.');
  }
  if (input.expectedCentavos <= 0n ||
      input.receivedCentavos !== input.expectedCentavos) {
    throw new Error('Bank credit must match the exact invoice amount in centavos.');
  }
  const reference = String(input.bankReference || '').trim().toUpperCase();
  if (!/^[A-Z0-9._-]{6,80}$/.test(reference)) {
    throw new Error('Invalid reconciled InstaPay transfer reference.');
  }
  // A GLOBAL unique constraint on (receivingAccountId, bankReference) across
  // ALL invoices and tenants prevents one credited transfer paying two invoices.
  // The receivingAccountId must come from trusted server configuration.
  return { uniqueApprovalKey: input.receivingAccountId + ':' + reference,
    receivedCentavos: input.receivedCentavos };
}
