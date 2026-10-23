/** A student is eligible for an ordinary term fee only with an explicit enrolled record for that tenant and period. */
export function isEnrolledStatus(status: unknown): boolean {
  return typeof status === 'string' && status.trim().toUpperCase() === 'ENROLLED';
}
