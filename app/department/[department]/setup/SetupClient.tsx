"use client";

import { useState } from "react";
import { fmt } from "@/lib/utils";

const DEFAULT_FUNDS = [
  "General Fund (Carried Over)",
  "New Accounts (Current Operations)",
  "Collectibles Pool",
  "JIECEP Membership Fund",
  "General Orientation Fund",
  "FCUSR Activities Fund",
  "Sports & Cultural Fund",
  "JIECEP FCUSC Fund",
  "JIECEP Week Activities Fund",
  "ECE Grandball Fund",
  "Emergency/Calamity Fund",
  "JIECEP Activities Fund",
  "Others"
];

interface RolloverRecord {
  id: string;
  reference: string;
  sourcePeriod: string;
  destPeriod: string;
  amount: number;
  date: string;
  status: string;
  encodedBy: string;
}

export default function SetupClient({ department, organizationId }: { department: string, organizationId: string }) {
  const [targetAy, setTargetAy] = useState("A.Y. 2026 - 2027");
  const [targetTerm, setTargetTerm] = useState("2nd Sem");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetData, setPresetData] = useState<{name: string, amount: number}[]>([]);

  const [rolloverLogs, setRolloverLogs] = useState<RolloverRecord[]>([
    {
      id: "col-01",
      reference: "CO-20260115-093000",
      sourcePeriod: "1st Sem (A.Y. 2025 - 2026)",
      destPeriod: "2nd Sem (A.Y. 2025 - 2026)",
      amount: 16645.00,
      date: "2026-01-15",
      status: "Active",
      encodedBy: "Master Administrator"
    }
  ]);

  const [fundBalances, setFundBalances] = useState<Record<string, number>>(
    DEFAULT_FUNDS.reduce((acc, fund) => ({ ...acc, [fund]: 0 }), {})
  );

  const totalAllocation = Object.values(fundBalances).reduce((sum, val) => sum + (Number(val) || 0), 0);

  const handleFundChange = (fundName: string, value: string) => {
    setFundBalances(prev => ({
      ...prev,
      [fundName]: parseFloat(value) || 0
    }));
  };

  const handleResetZero = () => {
    if (confirm("Are you sure you want to reset all input fields to zero?")) {
      setFundBalances(DEFAULT_FUNDS.reduce((acc, fund) => ({ ...acc, [fund]: 0 }), {}));
    }
  };

  const handleOpenPreset = () => {
    setPresetData([
      { name: "General Fund (Carried Over)", amount: 16645.00 },
      { name: "FCUSR Activities Fund", amount: 7700.00 },
      { name: "General Orientation Fund", amount: 383.40 },
      { name: "JIECEP Membership Fund", amount: 5250.00 },
      { name: "Sports & Cultural Fund", amount: 31.50 }
    ]);
    setShowPresetModal(true);
  };

  const handlePresetApply = () => {
    const newBalances = { ...fundBalances };
    presetData.forEach(p => {
      if (newBalances[p.name] !== undefined) {
        newBalances[p.name] = p.amount;
      }
    });
    setFundBalances(newBalances);
    setShowPresetModal(false);
  };

  const handleReverseRollover = async (recordId: string, reference: string, amount: number) => {
    if (!confirm(`Are you sure you want to REVERSE rollover reference [${reference}] amounting to ${fmt(amount)}? This will deduct the funds back out of the destination pool.`)) {
      return;
    }

    try {
      setRolloverLogs(prev => prev.map(log => {
        if (log.id === recordId) {
          return { ...log, status: "Reversed / Voided" };
        }
        return log;
      }));
      alert(`Rollover ${reference} successfully reversed and voided.`);
    } catch (error: any) {
      alert("Error reversing rollover: " + error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalAllocation <= 0 && !confirm("Total allocation is ₱0.00. Do you still want to save?")) return;

    setIsSubmitting(true);
    try {
      await new Promise(res => setTimeout(res, 800));
      alert(`Initial fund allocations for ${targetTerm} (${targetAy}) saved successfully!`);
    } catch (error: any) {
      alert("Error saving funds: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto" style={{ maxWidth: '1150px', minWidth: 0 }}>
      {/* Header Toolbar */}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <div>
          <h5 className="text-accent m-0 fw-bold"><i className="bi bi-gear me-2"></i>Fund Allocation Initial Setup</h5>
          <small className="text-secondary">Initialize opening balances and carry over funds for upcoming academic terms.</small>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-outline-success btn-sm fw-bold" onClick={handleOpenPreset}>
            <i className="bi bi-box-arrow-in-right me-1"></i>Prepare Target Term (Rollover & Init)
          </button>
          <button className="btn btn-outline-secondary btn-sm" onClick={handleResetZero}>
            <i className="bi bi-arrow-counterclockwise me-1"></i>Reset Zero
          </button>
        </div>
      </div>

      {/* Target Period Selector */}
      <div className="card p-3 mb-3 border-secondary bg-card">
        <div className="text-secondary small fw-bold text-uppercase mb-2">
          <i className="bi bi-calendar-event me-2 text-info"></i>Target Academic Period for Setup
        </div>
        <div className="row g-2">
          <div className="col-12 col-md-6">
            <label className="form-label text-secondary small fw-semibold mb-1">Target Academic Year</label>
            <select className="form-select form-select-sm bg-dark text-white border-secondary" value={targetAy} onChange={e => setTargetAy(e.target.value)}>
              <option value="A.Y. 2025 - 2026">A.Y. 2025 - 2026</option>
              <option value="A.Y. 2026 - 2027">A.Y. 2026 - 2027</option>
              <option value="A.Y. 2027 - 2028">A.Y. 2027 - 2028</option>
            </select>
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label text-secondary small fw-semibold mb-1">Target Term</label>
            <select className="form-select form-select-sm bg-dark text-white border-secondary" value={targetTerm} onChange={e => setTargetTerm(e.target.value)}>
              <option value="1st Sem">1st Sem</option>
              <option value="2nd Sem">2nd Sem</option>
              <option value="Summer">Summer</option>
            </select>
          </div>
        </div>
      </div>

      {/* Total Display Banner */}
      <div className="alert alert-secondary py-2 px-3 mb-3 d-flex justify-content-between align-items-center border-secondary bg-dark text-white">
        <strong className="text-uppercase tracking-wider small">Total Initial Allocation Pool:</strong>
        <span className="fs-5 fw-bold text-accent">{fmt(totalAllocation)}</span>
      </div>

      {/* Fund Inputs Form - Bounded width per column */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="row g-3 mb-3">
          {DEFAULT_FUNDS.map((fund, idx) => (
            <div className="col-12 col-md-4" key={idx}>
              <label className="form-label text-secondary mb-1 text-truncate w-100" style={{ fontSize: '0.78rem' }} title={fund}>
                {fund}
              </label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-dark border-secondary text-secondary px-2">₱</span>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  className="form-control form-control-sm bg-card text-white border-secondary fw-semibold" 
                  value={fundBalances[fund] === 0 ? "" : fundBalances[fund]}
                  onChange={e => handleFundChange(fund, e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          ))}
        </div>

        <button type="submit" className="btn btn-info fw-bold w-100 btn-sm py-2" disabled={isSubmitting}>
          <i className="bi bi-check2-circle me-1"></i>
          {isSubmitting ? "Saving Allocations..." : `Save Initial Fund Allocations to ${targetTerm}`}
        </button>
      </form>

      {/* Rollover Audit Log & Reversal Center */}
      <div className="card p-3 border-secondary bg-card mb-3">
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
          <h6 className="text-accent fw-bold m-0" style={{ fontSize: '0.9rem' }}>
            <i className="bi bi-clock-history me-2"></i>Rollover History & Reversal Log
          </h6>
          <small className="text-secondary" style={{ fontSize: '0.75rem' }}>Inspect past carry-overs and reverse mistakes if necessary.</small>
        </div>

        <div className="table-responsive">
          <table className="table table-hover align-middle table-sm border-secondary text-white mb-0" style={{ fontSize: '0.82rem' }}>
            <thead>
              <tr className="text-secondary border-bottom border-secondary">
                <th style={{ width: '20%' }} className="py-2">Reference</th>
                <th style={{ width: '20%' }} className="py-2">Source Period</th>
                <th style={{ width: '20%' }} className="py-2">Destination Period</th>
                <th style={{ width: '12%' }} className="py-2 text-end">Amount</th>
                <th style={{ width: '10%' }} className="py-2">Date</th>
                <th style={{ width: '10%' }} className="py-2">Status</th>
                <th style={{ width: '8%' }} className="py-2 text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {rolloverLogs.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-secondary py-3">No rollover history recorded.</td></tr>
              ) : (
                rolloverLogs.map(log => (
                  <tr key={log.id}>
                    <td><span className="font-monospace text-info">{log.reference}</span></td>
                    <td>{log.sourcePeriod}</td>
                    <td>{log.destPeriod}</td>
                    <td className="text-end fw-bold text-success">{fmt(log.amount)}</td>
                    <td className="text-secondary">{log.date}</td>
                    <td>
                      <span className={`badge ${log.status === 'Active' ? 'bg-success' : 'bg-danger'}`} style={{ fontSize: '0.7rem' }}>
                        {log.status}
                      </span>
                    </td>
                    <td className="text-end">
                      {log.status === 'Active' ? (
                        <button 
                          className="btn btn-outline-danger btn-sm py-0 px-2"
                          style={{ fontSize: '0.7rem' }}
                          onClick={() => handleReverseRollover(log.id, log.reference, log.amount)}
                        >
                          <i className="bi bi-arrow-counterclockwise me-1"></i>Reverse
                        </button>
                      ) : (
                        <span className="text-muted small fst-italic">Reversed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legacy Preset Modal */}
      {showPresetModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card border-security bg-dark text-white shadow-lg">
              <div className="modal-header border-secondary">
                <h5 className="modal-title text-accent">
                  <i className="bi bi-box-arrow-in-right me-2"></i>Apply 2nd Semester Preparation Preset
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowPresetModal(false)}></button>
              </div>
              <div className="modal-body">
                <p className="text-secondary small mb-3">
                  This will automatically populate the initial fund allocations based on carried-over balances from the previous term.
                </p>
                
                <div className="alert alert-dark border-secondary small mb-3 text-secondary">
                  <div className="mb-2 text-white">
                    <strong>Target Period:</strong> {targetTerm} ({targetAy})
                  </div>
                  {presetData.map((item, i) => (
                    <div key={i}>
                      • {item.name}: <strong className="text-white">{fmt(item.amount)}</strong>
                    </div>
                  ))}
                  <div className="mt-2 pt-2 border-top border-secondary text-white">
                    <strong>Total Pool: {fmt(presetData.reduce((sum, item) => sum + item.amount, 0))}</strong>
                  </div>
                </div>

                <p className="text-secondary small mb-0">
                  You can review and edit the values on the form before clicking 'Save Initial Fund Allocations to Target Term'.
                </p>
              </div>
              <div className="modal-footer border-secondary">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPresetModal(false)}>Cancel</button>
                <button type="button" className="btn btn-success btn-sm fw-bold" onClick={handlePresetApply}>Proceed & Fill Form</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}