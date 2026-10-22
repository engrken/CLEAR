"use client";

import { useMemo, useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { fmt } from "@/lib/utils";
import { confirmCommittedChange } from '@/lib/clear-dialogs';
import { transferFunds, carryOverTermBalance } from "./actions";

interface Fund { name: string; balance: number }
interface Period { ay: string; term: string }
interface ActiveRollover {
  id: string;
  destinationAY: string;
  destinationTerm: string;
  amount: number;
  legacy: boolean;
}
interface RealignProps {
  department: string;
  ay: string;
  term: string;
  funds: Fund[];
  totalRemaining: number;
  unliquidated: number;
  cashierBalance: number;
  negativeFunds: Fund[];
  nextPeriod: Period;
  sourceFeeCount: number;
  destinationFeeCount: number;
  destinationGeneralBalance: number;
  activeRollover: ActiveRollover | null;
}

type Preview =
  | {
      kind: "transfer";
      amount: number;
      fromFund: string;
      toFund: string;
      reason: string;
      sourceBalance: number;
      targetBalance: number;
    }
  | {
      kind: "carry";
      amount: number;
      reason: string;
      sourceFunds: Fund[];
      sourceTotal: number;
      destinationBalance: number;
    };

const pesos = (amount: number) => fmt(amount);
const toCents = (n: number) => Math.round(n * 100);

export default function RealignManager({
  department,
  ay,
  term,
  funds,
  totalRemaining,
  unliquidated,
  cashierBalance,
  negativeFunds,
  nextPeriod,
  sourceFeeCount,
  destinationFeeCount,
  destinationGeneralBalance,
  activeRollover,
}: RealignProps) {
  const router = useRouter();
  const [fromFund, setFromFund] = useState(funds[0]?.name ?? "");
  const [toFund, setToFund] = useState(funds[1]?.name ?? "");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [feePolicy, setFeePolicy] = useState<"retain" | "manual">("manual");
  const [carryReason, setCarryReason] = useState(
    `Term-end rollover into ${nextPeriod.term} (${nextPeriod.ay}) General Fund`
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; success: boolean } | null>(null);

  useEffect(() => {
    if (!funds.some(f => f.name === fromFund)) setFromFund(funds[0]?.name ?? "");
    if (!funds.some(f => f.name === toFund)) setToFund(funds.find(f => f.name !== fromFund)?.name ?? "");
  }, [funds, fromFund, toFund]);

  const from = funds.find(f => f.name === fromFund);
  const canCarry = !activeRollover && negativeFunds.length === 0 && toCents(totalRemaining) >= 0 && toCents(unliquidated) === 0 && toCents(cashierBalance) === 0;
  const positiveFunds = useMemo(() => funds.filter(f => toCents(f.balance) > 0), [funds]);

  function openTransferPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const n = Number(transferAmount);
    const reason = transferReason.trim();
    const destination = funds.find(f => f.name === toFund);
    if (!from || !destination) return setFeedback({ message: "Select both fund pools.", success: false });
    if (fromFund === toFund) return setFeedback({ message: "Select two different fund pools.", success: false });
    if (!Number.isFinite(n) || toCents(n) <= 0) return setFeedback({ message: "Enter a positive transfer amount.", success: false });
    if (Math.abs(n * 100 - Math.round(n * 100)) > 0.000001) return setFeedback({ message: "Use only two decimal places.", success: false });
    if (toCents(n) > toCents(from.balance)) return setFeedback({ message: `Insufficient balance in ${fromFund}.`, success: false });
    if (!reason) return setFeedback({ message: "Enter a transfer reason.", success: false });
    setPreview({
      kind: "transfer", amount: Math.round(n * 100) / 100,
      fromFund, toFund, reason, sourceBalance: from.balance, targetBalance: destination.balance,
    });
  }

  function openCarryPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (!canCarry) return;
    if (feePolicy === "retain" && (sourceFeeCount === 0 || destinationFeeCount > 0)) {
      return setFeedback({ success: false, message: sourceFeeCount === 0
        ? "No source fee items exist to copy. Select manual fee setup."
        : "Next period already has fee items. Select manual configuration to preserve them." });
    }
    const reason = carryReason.trim();
    if (!reason) return setFeedback({ message: "Enter a carry-over justification.", success: false });
    setPreview({
      kind: "carry", amount: totalRemaining, reason,
      sourceFunds: positiveFunds,
      sourceTotal: totalRemaining,
      destinationBalance: destinationGeneralBalance,
    });
  }

  async function execute() {
    if (!preview || saving) return;
    if (preview.kind === 'carry' && !await confirmCommittedChange({
      action: 'Confirm closing and carrying forward this term',
      target: `${ay} ${term} → ${nextPeriod.ay} ${nextPeriod.term} · ${pesos(preview.amount)}`,
      consequence: 'The source academic term will close and remaining funds will carry to the next term. Reopening requires an authorized reversal.',
      destructive: true,
      confirmText: 'Close Term and Carry Over',
    })) return;
    setSaving(true);
    setFeedback(null);
    try {
      if (preview.kind === "transfer") {
        await transferFunds(department, {
          fromFund: preview.fromFund, toFund: preview.toFund,
          amount: preview.amount, reason: preview.reason, ay, term,
        });
        setTransferAmount("");
        setTransferReason("");
        setFeedback({ message: `${pesos(preview.amount)} transferred successfully. Balances have been updated.`, success: true });
      } else {
        const result = await carryOverTermBalance(department, {
          sourceAY: ay, sourceTerm: term,
          destAY: nextPeriod.ay, destTerm: nextPeriod.term,
          amount: preview.amount, reason: preview.reason, feePolicy,
          expectedSourceFeeCount: sourceFeeCount,
        });
        setFeedback({
          message: `Closed ${term} (${ay}); opened ${result.destinationTerm} (${result.destinationAY}). ${pesos(result.amount)} transferred to General Fund. Outstanding student arrears remain enforceable.`,
          success: true,
        });
        router.push(`/department/${encodeURIComponent(department)}/realign?ay=${encodeURIComponent(result.destinationAY)}&term=${encodeURIComponent(result.destinationTerm)}`);
      }
      setPreview(null);
      router.refresh();
    } catch (error: unknown) {
      setPreview(null);
      setFeedback({ message: error instanceof Error ? error.message : "Transaction failed.", success: false });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-lg-3">
          <div className="card bg-body-secondary border-secondary p-3 h-100">
            <span className="small text-muted">Current Accounting Period</span>
            <strong className="mt-1">{term}</strong>
            <span className="small">{ay}</span>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card bg-body-secondary border-secondary p-3 h-100">
            <span className="small text-muted">Available to Carry Over</span>
            <strong className={`fs-5 mt-1 ${totalRemaining < 0 ? "text-danger" : "text-success"}`}>
              {pesos(totalRemaining)}
            </strong>
            <small className="text-muted">After payments, audits &amp; pending advances</small>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card bg-body-secondary border-secondary p-3 h-100">
            <span className="small text-muted">Outstanding Pending Advances</span>
            <strong className="fs-5 mt-1">{pesos(unliquidated)}</strong>
            <small className="text-muted">Already excluded from available balance</small>
          </div>
        </div>
        <div className="col-sm-6 col-lg-3">
          <div className="card bg-body-secondary border-secondary p-3 h-100">
            <span className="small text-muted">Next Accounting Period</span>
            <strong className="mt-1">{nextPeriod.term}</strong>
            <span className="small">{nextPeriod.ay}</span>
          </div>
        </div>
      </div>

      {feedback && (
        <div role="alert" className={`alert ${feedback.success ? "alert-success" : "alert-danger"} d-flex justify-content-between align-items-start`}>
          <span>{feedback.message}</span>
          <button type="button" className="btn-close ms-2" aria-label="Dismiss" onClick={() => setFeedback(null)} />
        </div>
      )}

      <div className="row g-4">
        <div className="col-12 col-lg-6">
          <div className="card p-3 border-secondary shadow-sm h-100">
            <h6 className="fw-bold text-info mb-2">
              <i className="bi bi-arrow-left-right me-2" />Inter-Fund Realignment
            </h6>
            <p className="small text-muted">
              Move an amount from one existing fund pool to another in {term} ({ay}).
              The total term balance remains unchanged.
            </p>
            {activeRollover && <div className="alert alert-info small">This source term is closed by an active rollover. Reverse it in Setup to reopen inter-fund realignments.</div>}
            <form onSubmit={openTransferPreview}>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Source Fund Pool</label>
                <select className="form-select" value={fromFund} onChange={e => setFromFund(e.target.value)} disabled={saving || !!activeRollover || funds.length === 0} required>
                  <option value="" disabled>Select source fund</option>
                  {funds.map(f => <option key={f.name} value={f.name}>{f.name} — {pesos(f.balance)}</option>)}
                </select>
                <div className="form-text">Available: {pesos(from?.balance ?? 0)}</div>
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Destination Fund Pool</label>
                <select className="form-select" value={toFund} onChange={e => setToFund(e.target.value)} disabled={saving || !!activeRollover || funds.length === 0} required>
                  <option value="" disabled>Select destination fund</option>
                  {funds.map(f => <option key={f.name} value={f.name}>{f.name} — {pesos(f.balance)}</option>)}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Amount (₱)</label>
                <input className="form-control" type="number" min="0.01" step="0.01" max={from ? Math.max(0, from.balance) : undefined}
                  value={transferAmount} onChange={e => setTransferAmount(e.target.value)} placeholder="0.00" disabled={saving || !!activeRollover} required />
              </div>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Reason / Justification</label>
                <input className="form-control" maxLength={500} value={transferReason} onChange={e => setTransferReason(e.target.value)}
                  placeholder="e.g. Approved reallocation for activity expenses" disabled={saving || !!activeRollover} required />
              </div>
              <button type="submit" className="btn btn-info fw-bold w-100" disabled={saving || !!activeRollover || funds.length < 2}>
                <i className="bi bi-eye me-2" />Preview Inter-Fund Transfer
              </button>
            </form>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card p-3 border-secondary shadow-sm h-100">
            <h6 className="fw-bold text-warning mb-2">
              <i className="bi bi-box-arrow-in-right me-2" />End-of-Term Balance Carry-Over
            </h6>
            <p className="small text-muted mb-3">
              Transfer the <strong>entire remaining available balance</strong> from all current fund pools into
              the next term&apos;s <strong>General Fund</strong>.
              Both periods are adjusted. No amount entry is needed.
            </p>
            <div className="border rounded border-secondary p-3 mb-3 bg-body-secondary">
              <div className="small text-muted mb-1">Source</div>
              <div className="fw-semibold">{term} — {ay}</div>
              <div className="small text-muted mt-2 mb-1">Destination</div>
              <div className="fw-semibold">General Fund</div>
              <div className="small">{nextPeriod.term} — {nextPeriod.ay}</div>
              <hr />
              <div className="d-flex justify-content-between">
                <strong>Automatic Rollover</strong><strong className="text-success">{pesos(Math.max(0, totalRemaining))}</strong>
              </div>
              <div className="d-flex justify-content-between small text-muted mt-1">
                <span>Destination General Fund now</span><span>{pesos(destinationGeneralBalance)}</span>
              </div>
            </div>

            {activeRollover ? (
              <div className="alert alert-info small">
                <i className="bi bi-check-circle me-2" />
                This term already has an active carry-over of <strong>{pesos(activeRollover.amount)}</strong> into
                {" "}{activeRollover.destinationTerm} ({activeRollover.destinationAY}).
                To carry over again, reverse the previous rollover from Setup first.
                {activeRollover.legacy && <div className="mt-1">This is a legacy rollover without a per-fund source breakdown.</div>}
              </div>
            ) : unliquidated > 0 ? (
              <div className="alert alert-warning small">Resolve pending cash advances ({pesos(unliquidated)}) before closing the term.</div>
            ) : Math.abs(cashierBalance) > 0.005 ? (
              <div className="alert alert-warning small">The University Cashier still holds {pesos(cashierBalance)} for this term. Settle cashier custody before carrying over.</div>
            ) : negativeFunds.length > 0 ? (
              <div className="alert alert-warning small">
                <strong>Resolve deficits first:</strong>
                {negativeFunds.map(f => <div key={f.name}>{f.name}: {pesos(f.balance)}</div>)}
                Realign available funds to these pools before carrying over.
              </div>
            ) : totalRemaining <= 0 ? (
              <div className="alert alert-secondary small">A zero-balance period may still be closed and the next period opened.</div>
            ) : (
              <div className="alert alert-warning small">
                <strong>Term closing:</strong> Confirm all collections, liquidations, and advances are
                correctly posted. Subsequent source-term transactions can create a new balance and
                will not be automatically included in this carry-over.
              </div>
            )}

            <form onSubmit={openCarryPreview}>
              <fieldset className="border border-secondary rounded p-3 mb-3">
                <legend className="float-none w-auto px-2 small fw-bold">Next-Term Collection Fee Setup</legend>
                <label className="d-block mb-2"><input type="radio" name="feePolicy" className="form-check-input me-2" checked={feePolicy === "manual"} onChange={() => setFeePolicy("manual")} disabled={saving} />Configure next-term fees manually (preserve any existing fees)</label>
                <label className="d-block"><input type="radio" name="feePolicy" className="form-check-input me-2" checked={feePolicy === "retain"} onChange={() => setFeePolicy("retain")} disabled={saving || sourceFeeCount === 0 || destinationFeeCount > 0} />Retain and copy {sourceFeeCount} current fee item(s) into the next term</label>
                <div className="text-muted small mt-2">Next-period existing fees: {destinationFeeCount}. Copy is allowed only when no destination fees exist. Both package status and destination fund are retained.</div>
              </fieldset>
              <label className="form-label small fw-semibold">Carry-Over Justification</label>
              <input className="form-control mb-3" maxLength={500} value={carryReason} onChange={e => setCarryReason(e.target.value)} disabled={saving || !canCarry} required />
              <button type="submit" className="btn btn-warning fw-bold w-100" disabled={saving || !canCarry}>
                <i className="bi bi-eye me-2" />Preview Close Term &amp; Open Next
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="card border-secondary mt-4">
        <div className="card-header bg-body-secondary fw-semibold"><i className="bi bi-wallet2 me-2" />Current Fund Pool Balances</div>
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0">
            <thead><tr><th>Fund Pool</th><th className="text-end">Available Balance</th></tr></thead>
            <tbody>
              {funds.length === 0 ? <tr><td colSpan={2} className="text-center text-muted py-3">No fund records for this period.</td></tr> :
                funds.map(f => <tr key={f.name}><td>{f.name}</td><td className={`text-end fw-semibold ${f.balance < 0 ? "text-danger" : ""}`}>{pesos(f.balance)}</td></tr>)}
            </tbody>
            <tfoot><tr className="fw-bold"><td>Total Remaining</td><td className="text-end">{pesos(totalRemaining)}</td></tr></tfoot>
          </table>
        </div>
      </div>

      {preview && (
        <div className="modal fade show d-block" role="dialog" aria-modal="true" aria-label="Confirm fund transaction"
          style={{ backgroundColor: "rgba(0,0,0,.65)" }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content bg-body text-body border-secondary shadow-lg clear-theme-modal">
              <div className="modal-header border-secondary">
                <h5 className="modal-title fw-bold"><i className="bi bi-shield-check me-2" />{preview.kind === "transfer" ? "Confirm Fund Realignment" : "Confirm End-of-Term Carry-Over"}</h5>
                <button type="button" className="btn-close" disabled={saving} onClick={() => setPreview(null)} aria-label="Close" />
              </div>
              <div className="modal-body">
                <p className="small text-muted">
                  This preview uses the currently displayed balances. The server will verify all
                  balances again before saving the transaction.
                </p>
                {preview.kind === "transfer" ? (
                  <table className="table table-bordered table-sm">
                    <thead><tr><th>Fund Pool</th><th className="text-end">Before</th><th className="text-end">Change</th><th className="text-end">After</th></tr></thead>
                    <tbody>
                      <tr><td>{preview.fromFund}</td><td className="text-end">{pesos(preview.sourceBalance)}</td><td className="text-end text-danger">-{pesos(preview.amount)}</td><td className="text-end fw-bold">{pesos(preview.sourceBalance - preview.amount)}</td></tr>
                      <tr><td>{preview.toFund}</td><td className="text-end">{pesos(preview.targetBalance)}</td><td className="text-end text-success">+{pesos(preview.amount)}</td><td className="text-end fw-bold">{pesos(preview.targetBalance + preview.amount)}</td></tr>
                    </tbody>
                  </table>
                ) : (
                  <>
                    <div className="mb-2"><strong>From:</strong> {term} ({ay})</div>
                    <div className="mb-3"><strong>To:</strong> {nextPeriod.term} ({nextPeriod.ay}), General Fund</div>
                    <div className="mb-3"><strong>Collection fee setup:</strong> {feePolicy === "retain" ? `Copy ${sourceFeeCount} configured fees` : "Configure fees manually"}</div>
                    <table className="table table-sm table-bordered">
                      <thead><tr><th>Current Fund Pool to Close</th><th className="text-end">Amount Forwarded</th></tr></thead>
                      <tbody>
                        {preview.sourceFunds.map(f => <tr key={f.name}><td>{f.name}</td><td className="text-end">{pesos(f.balance)}</td></tr>)}
                      </tbody>
                      <tfoot><tr className="fw-bold"><td>Total Forwarded</td><td className="text-end">{pesos(preview.sourceTotal)}</td></tr></tfoot>
                    </table>
                    <p className="small mb-0">Destination General Fund after carry-over: <strong>{pesos(preview.destinationBalance + preview.amount)}</strong>.</p>
                  </>
                )}
                <div className="small text-muted mt-3"><strong>Reason:</strong> {preview.reason}</div>
              </div>
              <div className="modal-footer border-secondary">
                <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setPreview(null)}>Cancel</button>
                <button type="button" className="btn btn-info fw-bold" disabled={saving} onClick={execute}>
                  {saving ? "Verifying & Saving..." : "Confirm & Execute"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
