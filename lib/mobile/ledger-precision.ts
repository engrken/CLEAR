/**
 * Read-only ledger precision boundary.
 *
 * Keep the existing exact centavo parser. An invalid source amount must not
 * become ₱0.00, a rounded receipt or an apparently complete ledger total.
 * Error metadata is deliberately limited to fixed category/field names:
 * never include student, receipt, tenant, value, or session information.
 */
import { moneyCentavos, type MoneyScalar } from '../money-precision';

export type LedgerMoneySource =
  | 'collection'
  | 'online-remittance'
  | 'penalty'
  | 'advance'
  | 'cashier-remittance';

export type LedgerMoneyField =
  | 'amountPaid'
  | 'balanceDue'
  | 'fineAmount'
  | 'assessedAmount'
  | 'ratePerHour'
  | 'hoursLate'
  | 'amountApproved'
  | 'amount';

export class LedgerReadIntegrityError extends Error {
  constructor(
    public readonly source: LedgerMoneySource,
    public readonly field: LedgerMoneyField,
  ) {
    super('Ledger monetary precision requires verification.');
    this.name = 'LedgerReadIntegrityError';
  }
}

/**
 * A missing required financial field is an error (not zero). Prisma Decimal
 * and exact number/string values are processed by the shared centavo parser.
 */
export function ledgerCentavos(
  source: LedgerMoneySource,
  field: LedgerMoneyField,
  value: MoneyScalar | null | undefined,
): number {
  if (value == null) throw new LedgerReadIntegrityError(source, field);
  try {
    return moneyCentavos(value);
  } catch {
    throw new LedgerReadIntegrityError(source, field);
  }
}

/**
 * Older penalty assessments have no stored assessedAmount. Reconstruct their
 * original assessment from whole service minutes and the exact cents-per-hour
 * rate, mirroring recordPenalty() and settlePenaltyCommunityService().
 *
 * hoursLate is a duration Float, NOT a currency field. A valid whole-minute
 * duration may have binary floating-point noise (e.g. 1/60 hours). Do not
 * pass its fractional peso equivalent to the strict currency parser.
 */
export function legacyPenaltyAssessedCentavos(
  hoursLate: number,
  ratePerHour: MoneyScalar,
): number {
  const minuteFloat = Number(hoursLate) * 60;
  const minuteCount = Math.round(minuteFloat);
  if (!Number.isFinite(minuteFloat) || minuteFloat < 0 ||
      !Number.isSafeInteger(minuteCount) ||
      Math.abs(minuteFloat - minuteCount) > 0.0001) {
    throw new LedgerReadIntegrityError('penalty', 'hoursLate');
  }
  const rateCents = ledgerCentavos('penalty', 'ratePerHour', ratePerHour);
  const assessmentCents = Math.round(minuteCount * rateCents / 60);
  if (!Number.isSafeInteger(assessmentCents) || assessmentCents < 0) {
    throw new LedgerReadIntegrityError('penalty', 'assessedAmount');
  }
  return assessmentCents;
}
