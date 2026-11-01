/** Monetary inputs are integer centavos; never coerce floats or numeric strings. */
export type MobilePaymentInput = Readonly<{
  studentId: string; feeId: string; amountCentavos: number;
  orNumber: string; idempotencyKey: string;
}>;

export function normalizeMobilePayment(input: MobilePaymentInput): MobilePaymentInput {
  const studentId = input.studentId.trim();
  const feeId = input.feeId.trim();
  const orNumber = input.orNumber.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  if (!Number.isSafeInteger(input.amountCentavos) || input.amountCentavos <= 0) {
    throw new Error('Payment amount must be positive integer centavos.');
  }
  if (!studentId || !feeId || !orNumber || !idempotencyKey || idempotencyKey.length > 128) {
    throw new Error('Payment requires student, fee, receipt number and stable retry key.');
  }
  if (/[\x00-\x1f\x7f]/.test(orNumber + idempotencyKey)) {
    throw new Error('Receipt number and retry key cannot contain control characters.');
  }
  return { studentId, feeId, orNumber, idempotencyKey, amountCentavos: input.amountCentavos };
}
