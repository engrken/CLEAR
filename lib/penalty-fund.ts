/** Single policy name used by ALL CLEAR tenants and academic periods.
 * Each tenant receives its own Fund row; no balances are shared.
 * Browser-safe: imports no database or server-only modules.
 */
export const PENALTY_FUND_NAME = "Penalty Fund" as const;
