/**
 * A receipt can have multiple package lines. Reserve its base number against
 * both exact matches and the package-line suffix used by CLEAR.
 */
export function receiptNumberConflictWhere(organizationId: string, rawOr: string) {
  const orNumber = rawOr.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,50}$/.test(orNumber)) {
    throw new Error("Invalid official receipt number.");
  }
  return {
    organizationId,
    OR: [
      { orNumber },
      { orNumber: { startsWith: `${orNumber}-P` } },
    ],
  };
}
