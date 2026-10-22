// /app/department/[department]/(protected)/setup/SetupClient.tsx



"use client";
import { clearAlert, clearConfirm, clearPrompt } from "@/lib/clear-dialogs";
import { confirmCommittedChange } from '@/lib/clear-dialogs';


import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fmt } from "@/lib/utils";
import { configurationForYear, periodsFor, type CalendarByYear } from "@/lib/academic-periods";
import {
  saveInitialFunds,
  reverseRollover,
} from "./actions";
import EditLogoForm from "./EditLogoForm";

interface RolloverRecord {
  id: string;
  reference: string;
  sourcePeriod: string;
  destPeriod: string;
  amount: number;
  date: string;
  status: string;
  encodedBy: string;
  reversalReason?: string | null;
  reversedBy?: string | null;
  reversedAt?: string | null;
}

interface FundItem {
  id?: string;
  fundName: string;
  amount: number;
}

export default function SetupClient({
  department,
  organizationId,
  initialFundNames,
  currentLogo,
  activeAy,
  activeTerm,
  initialRolloverLogs,
  allocationsByPeriod = {},
  closedPeriods = [],
  financialPeriods = [],
  fundLockReasonsByPeriod = {},
  calendarConfigs = {},
}: {
  department: string;
  organizationId: string;
  initialFundNames: string[];
  currentLogo?: string | null;
  activeAy: string;
  activeTerm: string;
  initialRolloverLogs: RolloverRecord[];
  allocationsByPeriod?: Record<string, FundItem[]>;
  closedPeriods?: string[];
  financialPeriods?: string[];
  fundLockReasonsByPeriod?: Record<string, Record<string, string>>;
  calendarConfigs?: CalendarByYear;
}) {
  const router = useRouter();
  const [targetAy, setTargetAy] = useState(
    activeAy || "A.Y. 2026 - 2027"
  );

  const [targetTerm, setTargetTerm] = useState(
    activeTerm || "1st Sem"
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reversingId, setReversingId] = useState<string | null>(null);

  const allowedTerms = periodsFor(configurationForYear(targetAy, calendarConfigs));
  const effectiveTerm = allowedTerms.includes(targetTerm) ? targetTerm : allowedTerms[0];
  const periodKey = `${targetAy}|${effectiveTerm}`;
  useEffect(() => { if (targetTerm !== effectiveTerm) setTargetTerm(effectiveTerm); }, [targetTerm, effectiveTerm]);
  const [savedAllocations, setSavedAllocations] = useState(allocationsByPeriod);
  const isClosed = closedPeriods.includes(periodKey);
  const hasFinancialActivity = financialPeriods.includes(periodKey);
  const fundLocks = fundLockReasonsByPeriod[periodKey] || {};
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [fundList, setFundList] = useState<FundItem[]>(() =>
    (allocationsByPeriod[`${activeAy}|${activeTerm}`] || initialFundNames.map(name => ({ fundName: name, amount: 0 })))
      .map(fund => ({ ...fund }))
  );
  useEffect(() => {
    setSavedAllocations(allocationsByPeriod);
    setFundList((allocationsByPeriod[periodKey] || initialFundNames.map(name => ({ fundName: name, amount: 0 })))
      .map(fund => ({ ...fund })));
    setAdjustmentReason("");
  }, [periodKey, allocationsByPeriod, initialFundNames]);

  const [rolloverLogs, setRolloverLogs] =
    useState<RolloverRecord[]>(initialRolloverLogs);

  const totalAllocation = fundList.reduce(
    (sum, item) => sum + (Number(item.amount) || 0),
    0
  );

  // =========================================================================
  // FUND INPUT HANDLERS
  // =========================================================================

  const handleFundChange = (
    index: number,
    field: keyof FundItem,
    value: string
  ) => {
    if (isClosed || fundList[index]?.fundName.toLowerCase() === "penalty fund" ||
        (fundList[index]?.id && fundLocks[fundList[index].id!])) return;
    setFundList((previous) =>
      previous.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        if (field === "amount") {
          return {
            ...item,
            amount: Number.parseFloat(value) || 0,
          };
        }

        return {
          ...item,
          fundName: value,
        };
      })
    );
  };

  const handleAddFund = () => {
    if (isClosed) return;
    setFundList((previous) => [
      ...previous,
      { fundName: "", amount: 0 },
    ]);
  };

  const handleRemoveFund = (index: number) => {
    if (isClosed || fundList[index]?.fundName.toLowerCase() === "penalty fund" ||
        (fundList[index]?.id && fundLocks[fundList[index].id!])) return;
    setFundList((previous) =>
      previous.filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const handleResetZero = async () => {
    if (
      !await clearConfirm(
        "Are you sure you want to reset all input fields to zero?"
      )
    ) {
      return;
    }

    setFundList((previous) =>
      previous.map((item) => item.id && fundLocks[item.id] ? item : { ...item, amount: 0 })
    );
  };

  // =========================================================================
  // PERSISTENT ROLLOVER REVERSAL
  // =========================================================================

  const handleReverseRollover = async (
    recordId: string,
    reference: string,
    amount: number
  ) => {
    if (reversingId) return;

    const rawReason = await clearPrompt(
      `Enter the reason for reversing rollover ${reference}:`
    );

    if (rawReason === null) return;

    const reason = rawReason.trim();

    if (!reason) {
      void clearAlert("A reason for the reversal is mandatory.");
      return;
    }

    if (
      !await clearConfirm(
        `Reverse rollover ${reference} for ${fmt(amount)}?\n\n` +
        `Reason: ${reason}\n\n` +
        "This action will be recorded in the database."
      )
    ) {
      return;
    }

    setReversingId(recordId);

    try {
      const result = await reverseRollover(
        department,
        recordId,
        reason
      );

      setRolloverLogs((previous) =>
        previous.map((log) =>
          log.id === recordId
            ? {
                ...log,
                status: "Reversed / Voided",
                reversalReason: reason,
                reversedBy: result.reversedBy,
                reversedAt: result.reversedAt,
              }
            : log
        )
      );

      void clearAlert(result.message);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";

      void clearAlert(`Error reversing rollover: ${message}`);
    } finally {
      setReversingId(null);
    }
  };

  // =========================================================================
  // SAVE INITIAL FUND ALLOCATIONS
  // =========================================================================

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isClosed) return void clearAlert("This term has already been carried forward and is closed. Reverse the rollover first.");

    if (fundList.some((fund) => !fund.fundName.trim())) {
      void clearAlert("Please ensure all target funds have a valid name.");
      return;
    }

    if (
      totalAllocation <= 0 &&
      !await clearConfirm(
        "Total allocation is ₱0.00. Do you still want to save?"
      )
    ) {
      return;
    }

    if (totalAllocation > 0 && !await confirmCommittedChange({
      action: 'Confirm fund allocation changes',
      target: `${targetAy} ${targetTerm} · Total allocation ${fmt(totalAllocation)}`,
      consequence: 'This will change initial fund allocations and may affect treasury balances. Verify all funds and the adjustment reason.',
      confirmText: 'Save Fund Allocations',
    })) return;
    setIsSubmitting(true);

    try {
      await saveInitialFunds(
        department,
        targetAy,
        targetTerm,
        fundList,
        adjustmentReason,
        (savedAllocations[periodKey] || []).flatMap(f => f.id ? [{ id: f.id, fundName: f.fundName, amount: f.amount }] : []),
      );

      router.refresh();
      void clearAlert(`Fund pool changes for ${targetTerm} (${targetAy}) saved successfully.`);
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";

      void clearAlert(`Error saving funds: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // USER INTERFACE
  // =========================================================================

  return (
    <div className="mx-auto" style={{ maxWidth: "1150px", minWidth: 0 }}>
      {/* Header Toolbar */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
        <div>
          <h5 className="text-accent m-0 fw-bold">
            <i className="bi bi-gear me-2" />
            Organization Setup
          </h5>
          <small className="text-secondary">
            Configure branding, initial balances, and carry-over funds.
          </small>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <Link
            href={`/department/${department}/setup/collections`}
            className="btn btn-outline-primary btn-sm fw-bold"
          >
            <i className="bi bi-list-check me-1" />
            Setup Collection Fees
          </Link>

          <Link
            href={
              `/department/${department}/realign?` +
              `ay=${encodeURIComponent(targetAy)}&` +
              `term=${encodeURIComponent(targetTerm)}`
            }
            className="btn btn-outline-success btn-sm fw-bold"
          >
            <i className="bi bi-box-arrow-in-right me-1" />
            Prepare Target Term (Rollover &amp; Init)
          </Link>

          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={handleResetZero}
          >
            <i className="bi bi-arrow-counterclockwise me-1" />
            Reset Zero
          </button>
        </div>
      </div>

      {/* Organization Branding */}
      <div className="card p-3 mb-4 border-secondary bg-card">
        <div className="text-secondary small fw-bold text-uppercase mb-3">
          <i className="bi bi-image me-2 text-info" />
          Organization Branding
        </div>

        <div className="row">
          <div className="col-12 col-md-6 col-lg-5">
            <EditLogoForm
              organizationId={organizationId}
              currentLogo={currentLogo}
            />
          </div>

          <div className="col-12 col-md-6 col-lg-7 d-none d-md-flex align-items-center">
            <p className="text-secondary small mb-0 px-3">
              This logo will be displayed on the main dashboard, printed
              reports, and student clearance certificates. Use a clear,
              high-resolution PNG, JPEG, or WebP image.
            </p>
          </div>
        </div>
      </div>

      {/* Target Academic Period */}
      <div className="card p-3 mb-3 border-secondary bg-card">
        <div className="text-secondary small fw-bold text-uppercase mb-2">
          <i className="bi bi-calendar-event me-2 text-info" />
          Target Academic Period for Setup
        </div>

        <div className="row g-2">
          <div className="col-12 col-md-6">
            <label className="form-label text-secondary small fw-semibold mb-1">
              Target Academic Year
            </label>

            <select
              className="form-select form-select-sm border-secondary"
              value={targetAy}
              onChange={(event) => setTargetAy(event.target.value)}
            >
              <option value="A.Y. 2025 - 2026">A.Y. 2025 - 2026</option>
              <option value="A.Y. 2026 - 2027">A.Y. 2026 - 2027</option>
              <option value="A.Y. 2027 - 2028">A.Y. 2027 - 2028</option>
              <option value="A.Y. 2028 - 2029">A.Y. 2028 - 2029</option>
              <option value="A.Y. 2029 - 2030">A.Y. 2029 - 2030</option>
            </select>
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label text-secondary small fw-semibold mb-1">
              Target Term
            </label>

            <select
              className="form-select form-select-sm border-secondary"
              value={targetTerm}
              onChange={(event) => setTargetTerm(event.target.value)}
            >
              {allowedTerms.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Initial Allocation Total */}
      <div className="alert alert-secondary py-2 px-3 mb-3 d-flex justify-content-between align-items-center border-secondary">
        <strong className="text-uppercase tracking-wider small">
          Total Initial Allocation Pool:
        </strong>

        <span className="fs-5 fw-bold text-accent">
          {fmt(totalAllocation)}
        </span>
      </div>

      {/* Initial Fund Allocation Form */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="row g-3 mb-3">
          {fundList.map((fund, index) => (
            <div className="col-12 col-md-4" key={index}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <input
                  type="text"
                  className="form-control form-control-sm border-0 bg-transparent text-secondary p-0 text-truncate fw-bold"
                  style={{
                    fontSize: "0.78rem",
                    boxShadow: "none",
                  }}
                  value={fund.fundName}
                  readOnly={isClosed || fund.fundName.toLowerCase() === "penalty fund" || Boolean(fund.id && fundLocks[fund.id])}
                  title={fund.id ? fundLocks[fund.id] || "No financial references — editable" : "New zero-opening fund"}
                  onChange={(event) =>
                    handleFundChange(
                      index,
                      "fundName",
                      event.target.value
                    )
                  }
                  placeholder="Enter Fund Name..."
                  required
                />

                <button
                  type="button"
                  className="btn-close"
                  style={{ fontSize: "0.5rem" }}
                  onClick={() => handleRemoveFund(index)}
                  disabled={isClosed || Boolean(fund.id && fundLocks[fund.id]) || fund.fundName.toLowerCase() === "penalty fund"}
                  title={fund.id && fundLocks[fund.id] ? `Locked: ${fundLocks[fund.id]}` : "Remove Fund"}
                  aria-label={`Remove ${fund.fundName || "fund"}`}
                />
              </div>

              <div className="input-group input-group-sm">
                <span className="input-group-text border-secondary text-secondary px-2">
                  ₱
                </span>

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="form-control form-control-sm bg-card border-secondary fw-semibold"
                  value={fund.amount === 0 ? "" : fund.amount}
                  readOnly={isClosed || fund.fundName.toLowerCase() === "penalty fund" || Boolean(fund.id && fundLocks[fund.id])}
                  onChange={(event) =>
                    handleFundChange(
                      index,
                      "amount",
                      event.target.value
                    )
                  }
                  placeholder="0.00"
                />
              </div>
              {fund.id && fundLocks[fund.id] && (
                <small className="text-muted d-block mt-1" title={fundLocks[fund.id]}>
                  <i className="bi bi-lock-fill me-1" />Locked: {fundLocks[fund.id]}
                </small>
              )}
              {!fund.id && hasFinancialActivity && (
                <small className="text-info d-block mt-1">New pool: ₱0.00 opening; fund it through Realignment.</small>
              )}
            </div>
          ))}

          <div className="col-12 col-md-4 d-flex align-items-end">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm w-100"
              style={{ height: "31px" }}
              onClick={handleAddFund}
              disabled={isClosed || isSubmitting}
            >
              <i className="bi bi-plus-lg me-1" />
              Add Target Fund
            </button>
          </div>
        </div>

        {isClosed ? (
          <div className="alert alert-warning py-2 small">
            This accounting period has been carried forward. Fund-pool changes are closed until its rollover is reversed.
          </div>
        ) : hasFinancialActivity ? (
          <div className="alert alert-info py-2 small">
            <strong>Active term:</strong> You can add new pools with ₱0.00 opening allocation, and edit or remove only pools that have no linked records.
            Referenced pools are individually locked. Use Realignment to fund newly created pools.
          </div>
        ) : (
          <div className="text-secondary small mb-2">No financial activity recorded in this term. Opening allocations may be configured.</div>
        )}
        {!isClosed && hasFinancialActivity && (
          <div className="mb-3">
            <label className="form-label text-secondary small fw-semibold" htmlFor="fund-adjustment-reason">
              Reason for modifying or removing an unused existing pool
            </label>
            <textarea
              id="fund-adjustment-reason"
              className="form-control form-control-sm border-secondary bg-card"
              rows={2}
              value={adjustmentReason}
              onChange={event => setAdjustmentReason(event.target.value)}
              maxLength={500}
              placeholder="Required for changes to existing opening allocations or fund names after financial activity (minimum 10 characters)."
            />
          </div>
        )}
        <button
          type="submit"
          className="btn btn-info fw-bold w-100 btn-sm py-2"
          disabled={isSubmitting || isClosed}
        >
          <i className="bi bi-check2-circle me-1" />
          {isSubmitting
            ? "Saving Allocations..."
            : `Save Fund Pools & Allocations to ${targetTerm}`}
        </button>
      </form>

      {/* Database-backed Rollover History */}
      <div className="card p-3 border-secondary bg-card mb-3">
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
          <h6
            className="text-accent fw-bold m-0"
            style={{ fontSize: "0.9rem" }}
          >
            <i className="bi bi-clock-history me-2" />
            Rollover History &amp; Reversal Log
          </h6>

          <small
            className="text-secondary"
            style={{ fontSize: "0.75rem" }}
          >
            Saved carry-overs and their recorded reversals.
          </small>
        </div>

        <div className="table-responsive">
          <table
            className="table table-hover align-middle table-sm border-secondary mb-0"
            style={{ fontSize: "0.82rem" }}
          >
            <thead>
              <tr className="text-secondary border-bottom border-secondary">
                <th style={{ width: "18%" }} className="py-2">
                  Reference
                </th>
                <th style={{ width: "19%" }} className="py-2">
                  Source Period
                </th>
                <th style={{ width: "19%" }} className="py-2">
                  Destination Period
                </th>
                <th style={{ width: "12%" }} className="py-2 text-end">
                  Amount
                </th>
                <th style={{ width: "10%" }} className="py-2">
                  Date
                </th>
                <th style={{ width: "12%" }} className="py-2">
                  Status / Reason
                </th>
                <th style={{ width: "10%" }} className="py-2 text-end">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {rolloverLogs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center text-secondary py-3"
                  >
                    No rollover history recorded for this organization.
                  </td>
                </tr>
              ) : (
                rolloverLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span className="font-monospace text-info">
                        {log.reference}
                      </span>
                      <div className="text-muted small">
                        By: {log.encodedBy || "System"}
                      </div>
                    </td>

                    <td>{log.sourcePeriod}</td>
                    <td>{log.destPeriod}</td>

                    <td className="text-end fw-bold">
                      {fmt(log.amount)}
                    </td>

                    <td className="text-secondary">
                      {log.date}
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          log.status === "Active"
                            ? "bg-success"
                            : "bg-danger"
                        }`}
                        style={{ fontSize: "0.7rem" }}
                      >
                        {log.status}
                      </span>

                      {log.reversalReason && (
                        <div
                          className="text-muted small mt-1"
                          title={
                            `Reversed by ${log.reversedBy || "Unknown"}` +
                            (
                              log.reversedAt
                                ? ` on ${log.reversedAt}`
                                : ""
                            )
                          }
                        >
                          <strong>Reason:</strong>{" "}
                          {log.reversalReason}
                        </div>
                      )}
                    </td>

                    <td className="text-end">
                      {log.status === "Active" ? (
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm py-0 px-2"
                          style={{ fontSize: "0.7rem" }}
                          disabled={reversingId !== null}
                          onClick={() =>
                            handleReverseRollover(
                              log.id,
                              log.reference,
                              log.amount
                            )
                          }
                        >
                          <i className="bi bi-arrow-counterclockwise me-1" />
                          {reversingId === log.id
                            ? "Reversing..."
                            : "Reverse"}
                        </button>
                      ) : (
                        <span className="text-muted small fst-italic">
                          Reversed
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
