-- CLEAR Financial Precision: transactional migration; do not deploy outside synchronized app cutover.
-- Preconditions: frozen web/mobile writes, current Production snapshot, reviewed preflight
-- and successful isolated branch rehearsal of this exact migration and app build.
-- All numeric conversions and post-conversion assertions are one atomic transaction.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
DO $preflight$ BEGIN
 IF EXISTS (SELECT 1 FROM "Fund" WHERE "initialAllocation"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: Fund.initialAllocation'; END IF;
 IF EXISTS (SELECT 1 FROM "Fund" WHERE "initialAllocation" IS NOT NULL AND ABS("initialAllocation"::numeric * 100 - ROUND("initialAllocation"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: Fund.initialAllocation'; END IF;
 IF EXISTS (SELECT 1 FROM "Fund" WHERE "initialAllocation" IS NOT NULL AND ABS("initialAllocation") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: Fund.initialAllocation'; END IF;
 IF EXISTS (SELECT 1 FROM "Fund" WHERE "currentBalance"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: Fund.currentBalance'; END IF;
 IF EXISTS (SELECT 1 FROM "Fund" WHERE "currentBalance" IS NOT NULL AND ABS("currentBalance"::numeric * 100 - ROUND("currentBalance"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: Fund.currentBalance'; END IF;
 IF EXISTS (SELECT 1 FROM "Fund" WHERE "currentBalance" IS NOT NULL AND ABS("currentBalance") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: Fund.currentBalance'; END IF;
 IF EXISTS (SELECT 1 FROM "Collection" WHERE "standardRate"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: Collection.standardRate'; END IF;
 IF EXISTS (SELECT 1 FROM "Collection" WHERE "standardRate" IS NOT NULL AND ABS("standardRate"::numeric * 100 - ROUND("standardRate"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: Collection.standardRate'; END IF;
 IF EXISTS (SELECT 1 FROM "Collection" WHERE "standardRate" IS NOT NULL AND ABS("standardRate") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: Collection.standardRate'; END IF;
 IF EXISTS (SELECT 1 FROM "Collection" WHERE "amountPaid"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: Collection.amountPaid'; END IF;
 IF EXISTS (SELECT 1 FROM "Collection" WHERE "amountPaid" IS NOT NULL AND ABS("amountPaid"::numeric * 100 - ROUND("amountPaid"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: Collection.amountPaid'; END IF;
 IF EXISTS (SELECT 1 FROM "Collection" WHERE "amountPaid" IS NOT NULL AND ABS("amountPaid") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: Collection.amountPaid'; END IF;
 IF EXISTS (SELECT 1 FROM "Collection" WHERE "balanceDue"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: Collection.balanceDue'; END IF;
 IF EXISTS (SELECT 1 FROM "Collection" WHERE "balanceDue" IS NOT NULL AND ABS("balanceDue"::numeric * 100 - ROUND("balanceDue"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: Collection.balanceDue'; END IF;
 IF EXISTS (SELECT 1 FROM "Collection" WHERE "balanceDue" IS NOT NULL AND ABS("balanceDue") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: Collection.balanceDue'; END IF;
 IF EXISTS (SELECT 1 FROM "CollectionSetup" WHERE "amount"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: CollectionSetup.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "CollectionSetup" WHERE "amount" IS NOT NULL AND ABS("amount"::numeric * 100 - ROUND("amount"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: CollectionSetup.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "CollectionSetup" WHERE "amount" IS NOT NULL AND ABS("amount") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: CollectionSetup.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "Penalty" WHERE "assessedAmount"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: Penalty.assessedAmount'; END IF;
 IF EXISTS (SELECT 1 FROM "Penalty" WHERE "assessedAmount" IS NOT NULL AND ABS("assessedAmount"::numeric * 100 - ROUND("assessedAmount"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: Penalty.assessedAmount'; END IF;
 IF EXISTS (SELECT 1 FROM "Penalty" WHERE "assessedAmount" IS NOT NULL AND ABS("assessedAmount") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: Penalty.assessedAmount'; END IF;
 IF EXISTS (SELECT 1 FROM "Penalty" WHERE "ratePerHour"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: Penalty.ratePerHour'; END IF;
 IF EXISTS (SELECT 1 FROM "Penalty" WHERE "ratePerHour" IS NOT NULL AND ABS("ratePerHour"::numeric * 100 - ROUND("ratePerHour"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: Penalty.ratePerHour'; END IF;
 IF EXISTS (SELECT 1 FROM "Penalty" WHERE "ratePerHour" IS NOT NULL AND ABS("ratePerHour") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: Penalty.ratePerHour'; END IF;
 IF EXISTS (SELECT 1 FROM "Penalty" WHERE "fineAmount"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: Penalty.fineAmount'; END IF;
 IF EXISTS (SELECT 1 FROM "Penalty" WHERE "fineAmount" IS NOT NULL AND ABS("fineAmount"::numeric * 100 - ROUND("fineAmount"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: Penalty.fineAmount'; END IF;
 IF EXISTS (SELECT 1 FROM "Penalty" WHERE "fineAmount" IS NOT NULL AND ABS("fineAmount") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: Penalty.fineAmount'; END IF;
 IF EXISTS (SELECT 1 FROM "CashAdvance" WHERE "amountApproved"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: CashAdvance.amountApproved'; END IF;
 IF EXISTS (SELECT 1 FROM "CashAdvance" WHERE "amountApproved" IS NOT NULL AND ABS("amountApproved"::numeric * 100 - ROUND("amountApproved"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: CashAdvance.amountApproved'; END IF;
 IF EXISTS (SELECT 1 FROM "CashAdvance" WHERE "amountApproved" IS NOT NULL AND ABS("amountApproved") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: CashAdvance.amountApproved'; END IF;
 IF EXISTS (SELECT 1 FROM "Audit" WHERE "budgetRequested"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: Audit.budgetRequested'; END IF;
 IF EXISTS (SELECT 1 FROM "Audit" WHERE "budgetRequested" IS NOT NULL AND ABS("budgetRequested"::numeric * 100 - ROUND("budgetRequested"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: Audit.budgetRequested'; END IF;
 IF EXISTS (SELECT 1 FROM "Audit" WHERE "budgetRequested" IS NOT NULL AND ABS("budgetRequested") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: Audit.budgetRequested'; END IF;
 IF EXISTS (SELECT 1 FROM "Audit" WHERE "totalExpense"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: Audit.totalExpense'; END IF;
 IF EXISTS (SELECT 1 FROM "Audit" WHERE "totalExpense" IS NOT NULL AND ABS("totalExpense"::numeric * 100 - ROUND("totalExpense"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: Audit.totalExpense'; END IF;
 IF EXISTS (SELECT 1 FROM "Audit" WHERE "totalExpense" IS NOT NULL AND ABS("totalExpense") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: Audit.totalExpense'; END IF;
 IF EXISTS (SELECT 1 FROM "Audit" WHERE "varianceReturn"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: Audit.varianceReturn'; END IF;
 IF EXISTS (SELECT 1 FROM "Audit" WHERE "varianceReturn" IS NOT NULL AND ABS("varianceReturn"::numeric * 100 - ROUND("varianceReturn"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: Audit.varianceReturn'; END IF;
 IF EXISTS (SELECT 1 FROM "Audit" WHERE "varianceReturn" IS NOT NULL AND ABS("varianceReturn") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: Audit.varianceReturn'; END IF;
 IF EXISTS (SELECT 1 FROM "Audit" WHERE "reimbursementDue"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: Audit.reimbursementDue'; END IF;
 IF EXISTS (SELECT 1 FROM "Audit" WHERE "reimbursementDue" IS NOT NULL AND ABS("reimbursementDue"::numeric * 100 - ROUND("reimbursementDue"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: Audit.reimbursementDue'; END IF;
 IF EXISTS (SELECT 1 FROM "Audit" WHERE "reimbursementDue" IS NOT NULL AND ABS("reimbursementDue") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: Audit.reimbursementDue'; END IF;
 IF EXISTS (SELECT 1 FROM "ExpenseItem" WHERE "subTotal"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: ExpenseItem.subTotal'; END IF;
 IF EXISTS (SELECT 1 FROM "ExpenseItem" WHERE "subTotal" IS NOT NULL AND ABS("subTotal"::numeric * 100 - ROUND("subTotal"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: ExpenseItem.subTotal'; END IF;
 IF EXISTS (SELECT 1 FROM "ExpenseItem" WHERE "subTotal" IS NOT NULL AND ABS("subTotal") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: ExpenseItem.subTotal'; END IF;
 IF EXISTS (SELECT 1 FROM "Collectible" WHERE "balanceDue"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: Collectible.balanceDue'; END IF;
 IF EXISTS (SELECT 1 FROM "Collectible" WHERE "balanceDue" IS NOT NULL AND ABS("balanceDue"::numeric * 100 - ROUND("balanceDue"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: Collectible.balanceDue'; END IF;
 IF EXISTS (SELECT 1 FROM "Collectible" WHERE "balanceDue" IS NOT NULL AND ABS("balanceDue") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: Collectible.balanceDue'; END IF;
 IF EXISTS (SELECT 1 FROM "OnlineRemittance" WHERE "amountPaid"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: OnlineRemittance.amountPaid'; END IF;
 IF EXISTS (SELECT 1 FROM "OnlineRemittance" WHERE "amountPaid" IS NOT NULL AND ABS("amountPaid"::numeric * 100 - ROUND("amountPaid"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: OnlineRemittance.amountPaid'; END IF;
 IF EXISTS (SELECT 1 FROM "OnlineRemittance" WHERE "amountPaid" IS NOT NULL AND ABS("amountPaid") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: OnlineRemittance.amountPaid'; END IF;
 IF EXISTS (SELECT 1 FROM "FundTransfer" WHERE "amount"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: FundTransfer.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "FundTransfer" WHERE "amount" IS NOT NULL AND ABS("amount"::numeric * 100 - ROUND("amount"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: FundTransfer.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "FundTransfer" WHERE "amount" IS NOT NULL AND ABS("amount") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: FundTransfer.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "VoidTransaction" WHERE "amount"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: VoidTransaction.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "VoidTransaction" WHERE "amount" IS NOT NULL AND ABS("amount"::numeric * 100 - ROUND("amount"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: VoidTransaction.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "VoidTransaction" WHERE "amount" IS NOT NULL AND ABS("amount") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: VoidTransaction.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "FundRealignment" WHERE "amount"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: FundRealignment.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "FundRealignment" WHERE "amount" IS NOT NULL AND ABS("amount"::numeric * 100 - ROUND("amount"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: FundRealignment.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "FundRealignment" WHERE "amount" IS NOT NULL AND ABS("amount") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: FundRealignment.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "CashierRemittance" WHERE "amount"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: CashierRemittance.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "CashierRemittance" WHERE "amount" IS NOT NULL AND ABS("amount"::numeric * 100 - ROUND("amount"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: CashierRemittance.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "CashierRemittance" WHERE "amount" IS NOT NULL AND ABS("amount") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: CashierRemittance.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "AcademicPeriodTransition" WHERE "amount"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: AcademicPeriodTransition.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "AcademicPeriodTransition" WHERE "amount" IS NOT NULL AND ABS("amount"::numeric * 100 - ROUND("amount"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: AcademicPeriodTransition.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "AcademicPeriodTransition" WHERE "amount" IS NOT NULL AND ABS("amount") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: AcademicPeriodTransition.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "ArrearPaymentLink" WHERE "amount"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: ArrearPaymentLink.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "ArrearPaymentLink" WHERE "amount" IS NOT NULL AND ABS("amount"::numeric * 100 - ROUND("amount"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: ArrearPaymentLink.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "ArrearPaymentLink" WHERE "amount" IS NOT NULL AND ABS("amount") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: ArrearPaymentLink.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "PenaltySettlementEvent" WHERE "amount"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: PenaltySettlementEvent.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "PenaltySettlementEvent" WHERE "amount" IS NOT NULL AND ABS("amount"::numeric * 100 - ROUND("amount"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: PenaltySettlementEvent.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "PenaltySettlementEvent" WHERE "amount" IS NOT NULL AND ABS("amount") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: PenaltySettlementEvent.amount'; END IF;
 IF EXISTS (SELECT 1 FROM "PenaltySettlementEvent" WHERE "balanceBefore"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: PenaltySettlementEvent.balanceBefore'; END IF;
 IF EXISTS (SELECT 1 FROM "PenaltySettlementEvent" WHERE "balanceBefore" IS NOT NULL AND ABS("balanceBefore"::numeric * 100 - ROUND("balanceBefore"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: PenaltySettlementEvent.balanceBefore'; END IF;
 IF EXISTS (SELECT 1 FROM "PenaltySettlementEvent" WHERE "balanceBefore" IS NOT NULL AND ABS("balanceBefore") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: PenaltySettlementEvent.balanceBefore'; END IF;
 IF EXISTS (SELECT 1 FROM "PenaltySettlementEvent" WHERE "balanceAfter"::text IN ('NaN', 'Infinity', '-Infinity')) THEN RAISE EXCEPTION 'Invalid nonfinite amount: PenaltySettlementEvent.balanceAfter'; END IF;
 IF EXISTS (SELECT 1 FROM "PenaltySettlementEvent" WHERE "balanceAfter" IS NOT NULL AND ABS("balanceAfter"::numeric * 100 - ROUND("balanceAfter"::numeric * 100)) > 0.000001) THEN RAISE EXCEPTION 'Subcent amount requires reconciliation: PenaltySettlementEvent.balanceAfter'; END IF;
 IF EXISTS (SELECT 1 FROM "PenaltySettlementEvent" WHERE "balanceAfter" IS NOT NULL AND ABS("balanceAfter") >= 10000000000000000) THEN RAISE EXCEPTION 'Amount outside Decimal(18,2) range: PenaltySettlementEvent.balanceAfter'; END IF;
END $preflight$;
-- Preserve independent NULL semantics, old receipt values, ORs and all associations.
ALTER TABLE "Fund"
  ALTER COLUMN "initialAllocation" TYPE NUMERIC(18,2) USING "initialAllocation"::NUMERIC(18,2),
  ALTER COLUMN "currentBalance" TYPE NUMERIC(18,2) USING "currentBalance"::NUMERIC(18,2);
ALTER TABLE "Collection"
  ALTER COLUMN "standardRate" TYPE NUMERIC(18,2) USING "standardRate"::NUMERIC(18,2),
  ALTER COLUMN "amountPaid" TYPE NUMERIC(18,2) USING "amountPaid"::NUMERIC(18,2),
  ALTER COLUMN "balanceDue" TYPE NUMERIC(18,2) USING "balanceDue"::NUMERIC(18,2);
ALTER TABLE "CollectionSetup"
  ALTER COLUMN "amount" TYPE NUMERIC(18,2) USING "amount"::NUMERIC(18,2);
ALTER TABLE "Penalty"
  ALTER COLUMN "assessedAmount" TYPE NUMERIC(18,2) USING "assessedAmount"::NUMERIC(18,2),
  ALTER COLUMN "ratePerHour" TYPE NUMERIC(18,2) USING "ratePerHour"::NUMERIC(18,2),
  ALTER COLUMN "fineAmount" TYPE NUMERIC(18,2) USING "fineAmount"::NUMERIC(18,2);
ALTER TABLE "CashAdvance"
  ALTER COLUMN "amountApproved" TYPE NUMERIC(18,2) USING "amountApproved"::NUMERIC(18,2);
ALTER TABLE "Audit"
  ALTER COLUMN "budgetRequested" TYPE NUMERIC(18,2) USING "budgetRequested"::NUMERIC(18,2),
  ALTER COLUMN "totalExpense" TYPE NUMERIC(18,2) USING "totalExpense"::NUMERIC(18,2),
  ALTER COLUMN "varianceReturn" TYPE NUMERIC(18,2) USING "varianceReturn"::NUMERIC(18,2),
  ALTER COLUMN "reimbursementDue" TYPE NUMERIC(18,2) USING "reimbursementDue"::NUMERIC(18,2);
ALTER TABLE "ExpenseItem"
  ALTER COLUMN "subTotal" TYPE NUMERIC(18,2) USING "subTotal"::NUMERIC(18,2);
ALTER TABLE "Collectible"
  ALTER COLUMN "balanceDue" TYPE NUMERIC(18,2) USING "balanceDue"::NUMERIC(18,2);
ALTER TABLE "OnlineRemittance"
  ALTER COLUMN "amountPaid" TYPE NUMERIC(18,2) USING "amountPaid"::NUMERIC(18,2);
ALTER TABLE "FundTransfer"
  ALTER COLUMN "amount" TYPE NUMERIC(18,2) USING "amount"::NUMERIC(18,2);
ALTER TABLE "VoidTransaction"
  ALTER COLUMN "amount" TYPE NUMERIC(18,2) USING "amount"::NUMERIC(18,2);
ALTER TABLE "FundRealignment"
  ALTER COLUMN "amount" TYPE NUMERIC(18,2) USING "amount"::NUMERIC(18,2);
ALTER TABLE "CashierRemittance"
  ALTER COLUMN "amount" TYPE NUMERIC(18,2) USING "amount"::NUMERIC(18,2);
ALTER TABLE "AcademicPeriodTransition"
  ALTER COLUMN "amount" TYPE NUMERIC(18,2) USING "amount"::NUMERIC(18,2);
ALTER TABLE "ArrearPaymentLink"
  ALTER COLUMN "amount" TYPE NUMERIC(18,2) USING "amount"::NUMERIC(18,2);
ALTER TABLE "PenaltySettlementEvent"
  ALTER COLUMN "amount" TYPE NUMERIC(18,2) USING "amount"::NUMERIC(18,2),
  ALTER COLUMN "balanceBefore" TYPE NUMERIC(18,2) USING "balanceBefore"::NUMERIC(18,2),
  ALTER COLUMN "balanceAfter" TYPE NUMERIC(18,2) USING "balanceAfter"::NUMERIC(18,2);
COMMIT;
