/** Monetary inputs are integer centavos; never coerce floats or numeric strings. */
export type MobilePaymentInput = Readonly<{
  studentId: string; feeId: string; amountCentavos: number;
  idempotencyKey: string;
}>;

export function normalizeMobilePayment(input: MobilePaymentInput): MobilePaymentInput {
  const studentId = input.studentId.trim();
  const feeId = input.feeId.trim();
  const idempotencyKey = input.idempotencyKey.trim();
  if (!Number.isSafeInteger(input.amountCentavos) || input.amountCentavos <= 0 || input.amountCentavos > 100_000_000) {
    throw new Error('Payment amount must be positive integer centavos within the server transaction limit.');
  }
  if (!studentId || studentId.length > 100 || !feeId || feeId.length > 200 || !idempotencyKey || idempotencyKey.length > 128) {
    throw new Error('Payment requires student, fee and stable retry key.');
  }
  if (/[\x00-\x1f\x7f]/.test(studentId + feeId + idempotencyKey)) {
    throw new Error('Payment identifiers cannot contain control characters.');
  }
  return { studentId, feeId, idempotencyKey, amountCentavos: input.amountCentavos };
}
