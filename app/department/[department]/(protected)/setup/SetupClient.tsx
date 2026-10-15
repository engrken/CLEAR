// /app/department/[department]/(protected)/setup/SetupClient.tsx

"use client";

import { useState } from "react";
import { fmt } from "@/lib/utils";
import Link from "next/link";
import { saveInitialFunds } from "./actions";
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
}

interface FundItem {
  fundName: string;
  amount: number;
}

export default function SetupClient({ 
  department, 
  organizationId,
  initialFundNames,
  currentLogo
}: { 
  department: string, 
  organizationId: string,
  initialFundNames: string[],
  currentLogo?: string | null
}) {
  const [targetAy, setTargetAy] = useState("A.Y. 2026 - 2027");
  const [targetTerm, setTargetTerm] = useState("2nd Sem");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  
  // Replace DEFAULT_FUNDS with a dynamic array of objects
  const [fundList, setFundList] = useState<FundItem[]>(
    initialFundNames.map(name => ({ fundName: name, amount: 0 }))
  );
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

  const totalAllocation = fundList.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  // Dynamic handlers for adding, editing, and removing funds
  const handleFundChange = (index: number, field: keyof FundItem, value: string) => {
    const newList = [...fundList];
    if (field === 'amount') {
      newList[index][field] = parseFloat(value) || 0;
    } else {
      newList[index][field] = value as string;
    }
    setFundList(newList);
  };

  const handleAddFund = () => {
    setFundList([...fundList, { fundName: "", amount: 0 }]);
  };

  const handleRemoveFund = (index: number) => {
    setFundList(fundList.filter((_, i) => i !== index));
  };

  const handleResetZero = () => {
    if (confirm("Are you sure you want to reset all input fields to zero?")) {
      setFundList(fundList.map(f => ({ ...f, amount: 0 })));
    }
  };

  const handleOpenPreset = () => {
    // Placeholder data - this would eventually be fetched via API based on the previous term's closing balances
    setPresetData([
      { name: "General Fund (Carried Over)", amount: 16645.00 },
      { name: "Current Operations", amount: 7700.00 }
    ]);
    setShowPresetModal(true);
  };

  const handlePresetApply = () => {
    const mergedList = [...fundList];
    presetData.forEach(p => {
      const existingIndex = mergedList.findIndex(f => f.fundName.toLowerCase() === p.name.toLowerCase());
      if (existingIndex >= 0) {
        mergedList[existingIndex].amount = p.amount;
      } else {
        mergedList.push({ fundName: p.name, amount: p.amount });
      }
    });
    setFundList(mergedList);
    setShowPresetModal(false);
  };

  const handleReverseRollover = async (recordId: string, reference: string, amount: number) => {
    if (!confirm(`Are you sure you want to REVERSE rollover reference [${reference}] amounting to ${fmt(amount)}?`)) return;
    try {
      setRolloverLogs(prev => prev.map(log => log.id === recordId ? { ...log, status: "Reversed / Voided" } : log));
      alert(`Rollover ${reference} successfully reversed and voided.`);
    } catch (error: any) {
      alert("Error reversing rollover: " + error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Prevent submitting unnamed funds
    if (fundList.some(f => f.fundName.trim() === "")) {
      return alert("Please ensure all target funds have a valid name.");
    }
    if (totalAllocation <= 0 && !confirm("Total allocation is ₱0.00. Do you still want to save?")) return;

    setIsSubmitting(true);
    try {
      await saveInitialFunds(department, targetAy, targetTerm, fundList); 
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
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
        <div>
          <h5 className="text-accent m-0 fw-bold"><i className="bi bi-gear me-2"></i>Organization Setup</h5>
          <small className="text-secondary">Configure branding, initial balances, and carry-over funds.</small>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Link href={`/department/${department}/setup/collections`} className="btn btn-outline-primary btn-sm fw-bold">
            <i className="bi bi-list-check me-1"></i>Setup Collection Fees
          </Link>
          <button className="btn btn-outline-success btn-sm fw-bold" onClick={handleOpenPreset}>
            <i className="bi bi-box-arrow-in-right me-1"></i>Prepare Target Term (Rollover & Init)
          </button>
          <button className="btn btn-outline-secondary btn-sm" onClick={handleResetZero}>
            <i className="bi bi-arrow-counterclockwise me-1"></i>Reset Zero
          </button>
        </div>
      </div>

      {/* =========================================
          NEW SECTION: ORGANIZATION BRANDING
      ========================================= */}
      <div className="card p-3 mb-4 border-secondary bg-card">
        <div className="text-secondary small fw-bold text-uppercase mb-3">
          <i className="bi bi-image me-2 text-info"></i>Organization Branding
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
              This logo will be displayed on the main dashboard, printed reports, and student clearance certificates. Upload a clear, high-resolution PNG or JPEG with a transparent background for the best results.
            </p>
          </div>
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
            <select className="form-select form-select-sm border-secondary" value={targetAy} onChange={e => setTargetAy(e.target.value)}>
              <option value="A.Y. 2025 - 2026">A.Y. 2025 - 2026</option>
              <option value="A.Y. 2026 - 2027">A.Y. 2026 - 2027</option>
              <option value="A.Y. 2027 - 2028">A.Y. 2027 - 2028</option>
            </select>
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label text-secondary small fw-semibold mb-1">Target Term</label>
            <select className="form-select form-select-sm border-secondary" value={targetTerm} onChange={e => setTargetTerm(e.target.value)}>
              <option value="1st Sem">1st Sem</option>
              <option value="2nd Sem">2nd Sem</option>
              <option value="Summer">Summer</option>
            </select>
          </div>
        </div>
      </div>

      {/* Total Display Banner */}
      <div className="alert alert-secondary py-2 px-3 mb-3 d-flex justify-content-between align-items-center border-secondary">
        <strong className="text-uppercase tracking-wider small">Total Initial Allocation Pool:</strong>
        <span className="fs-5 fw-bold text-accent">{fmt(totalAllocation)}</span>
      </div>

      {/* Dynamic Fund Inputs Form */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="row g-3 mb-3">
          {fundList.map((fund, idx) => (
            <div className="col-12 col-md-4" key={idx}>
              <div className="d-flex justify-content-between align-items-center mb-1">
                <input
                  type="text"
                  className="form-control form-control-sm border-0 bg-transparent text-secondary p-0 text-truncate fw-bold"
                  style={{ fontSize: '0.78rem', boxShadow: 'none' }}
                  value={fund.fundName}
                  onChange={e => handleFundChange(idx, 'fundName', e.target.value)}
                  placeholder="Enter Fund Name..."
                  required
                />
                <button
                  type="button"
                  className="btn-close"
                  style={{ fontSize: '0.5rem' }}
                  onClick={() => handleRemoveFund(idx)}
                  title="Remove Fund"
                ></button>
              </div>
              <div className="input-group input-group-sm">
                <span className="input-group-text border-secondary text-secondary px-2">₱</span>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  className="form-control form-control-sm bg-card border-secondary fw-semibold" 
                  value={fund.amount === 0 ? "" : fund.amount}
                  onChange={e => handleFundChange(idx, 'amount', e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          ))}
          
          <div className="col-12 col-md-4 d-flex align-items-end">
             <button type="button" className="btn btn-outline-secondary btn-sm w-100" style={{ height: '31px' }} onClick={handleAddFund}>
               <i className="bi bi-plus-lg me-1"></i> Add Target Fund
             </button>
          </div>
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
          <table className="table table-hover align-middle table-sm border-secondary mb-0" style={{ fontSize: '0.82rem' }}>
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
            <div className="modal-content card border-security shadow-lg">
              <div className="modal-header border-secondary">
                <h5 className="modal-title text-accent">
                  <i className="bi bi-box-arrow-in-right me-2"></i>Apply 2nd Semester Preparation Preset
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowPresetModal(false)}></button>
              </div>
              <div className="modal-body">
                <p className="text-secondary small mb-3">
                  This will automatically populate the initial fund allocations based on carried-over balances from the previous term.
                </p>
                
                <div className="alert alert-dark border-secondary small mb-3 text-secondary">
                  <div className="mb-2">
                    <strong>Target Period:</strong> {targetTerm} ({targetAy})
                  </div>
                  {presetData.map((item, i) => (
                    <div key={i}>
                      • {item.name}: <strong className="">{fmt(item.amount)}</strong>
                    </div>
                  ))}
                  <div className="mt-2 pt-2 border-top border-secondary">
                    <strong>Total Pool: {fmt(presetData.reduce((sum, item) => sum + item.amount, 0))}</strong>
                  </div>
                </div>
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