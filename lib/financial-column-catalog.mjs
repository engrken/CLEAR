/** Monetary Float columns awaiting a reviewed Decimal(18,2) conversion.
 * This is a frozen inventory, not permission to migrate any database.
 * The only other Float field in schema.prisma is Penalty.hoursLate (time).
 */
export const MONEY_COLUMNS = Object.freeze({
  Fund: ['initialAllocation', 'currentBalance'],
  Collection: ['standardRate', 'amountPaid', 'balanceDue'],
  CollectionSetup: ['amount'],
  Penalty: ['assessedAmount', 'ratePerHour', 'fineAmount'],
  CashAdvance: ['amountApproved'],
  Audit: ['budgetRequested', 'totalExpense', 'varianceReturn', 'reimbursementDue'],
  ExpenseItem: ['subTotal'],
  Collectible: ['balanceDue'],
  OnlineRemittance: ['amountPaid'],
  FundTransfer: ['amount'],
  VoidTransaction: ['amount'],
  FundRealignment: ['amount'],
  CashierRemittance: ['amount'],
  AcademicPeriodTransition: ['amount'],
  ArrearPaymentLink: ['amount'],
  PenaltySettlementEvent: ['amount', 'balanceBefore', 'balanceAfter'],
});
