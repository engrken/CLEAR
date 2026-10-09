"use client";

import { useState, useMemo, useEffect } from "react";
import { fmt } from "@/lib/utils";
import { recordAudit } from "./actions";
import { ThemedAlert } from '@/lib/alerts';

interface CashAdvance { id: string; advanceId: string; requestor: string; fundSource: string; amountApproved: number; }
interface Fund { id: string; fundName: string; }
interface ExpenseRow { 
  id: string; 
  qty: number; 
  orsi: string; 
  desc: string; 
  subTotal: number; 
  proofBase64?: string;
  proofMime?: string;
  fileName?: string;
}

export default function LiquidationsForm({
  department,
  ay,
  term,
  pendingAdvances,
  funds,
  prefillCaId
}: {
  department: string;
  ay: string;
  term: string;
  pendingAdvances: CashAdvance[];
  funds: Fund[];
  prefillCaId: string;
}) {
  const todayStr = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(todayStr);
  const [selectedCaRef, setSelectedCaRef] = useState(prefillCaId || "");
  const [requestor, setRequestor] = useState("");
  const [fundSource, setFundSource] = useState(funds[0]?.fundName || "General Fund (Carried Over)");
  const [budgetRequested, setBudgetRequested] = useState<number>(0);
  
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([
    { id: "1", qty: 1, orsi: "", desc: "", subTotal: 0 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fare Modal State
  const [showFareModal, setShowFareModal] = useState(false);
  const [fareMode, setFareMode] = useState("Tricycle");
  const [fareOrigin, setFareOrigin] = useState("");
  const [fareDestination, setFareDestination] = useState("");
  const [farePassengers, setFarePassengers] = useState(1);
  const [fareRate, setFareRate] = useState<number>(0);

  const computedFareTotal = farePassengers * fareRate;

  // Sync CA details when reference dropdown changes[cite: 5]
  useEffect(() => {
    if (selectedCaRef === "DIRECT") {
      setRequestor("Direct Expense");
      setBudgetRequested(0);
    } else {
      const match = pendingAdvances.find(ca => ca.advanceId === selectedCaRef);
      if (match) {
        setRequestor(match.requestor);
        setFundSource(match.fundSource);
        setBudgetRequested(match.amountApproved);
      } else {
        setRequestor("");
        setBudgetRequested(0);
      }
    }
  }, [selectedCaRef, pendingAdvances]);

  const totalExpense = useMemo(() => {
    return expenseRows.reduce((sum, r) => sum + (r.subTotal || 0), 0);
  }, [expenseRows]);

  const variance = budgetRequested - totalExpense;

  const addRow = (prefill?: Partial<ExpenseRow>) => {
    setExpenseRows([...expenseRows, {
      id: Math.random().toString(36).substring(2, 9),
      qty: prefill?.qty || 1,
      orsi: prefill?.orsi || "",
      desc: prefill?.desc || "",
      subTotal: prefill?.subTotal || 0,
      proofBase64: prefill?.proofBase64,
      proofMime: prefill?.proofMime,
      fileName: prefill?.fileName
    }]);
  };

  const updateRow = (id: string, field: keyof ExpenseRow, value: any) => {
    setExpenseRows(expenseRows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // Handle File Attachment per Row (Replaces handleItemSlipSelect)[cite: 5]
  const handleFileChange = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert("Attached receipt exceeds 8MB. Please select an image or PDF under 8MB.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setExpenseRows(expenseRows.map(r => r.id === id ? {
        ...r,
        proofBase64: uploadEvent.target?.result as string,
        proofMime: file.type || "image/jpeg",
        fileName: file.name
      } : r));
    };
    reader.readAsDataURL(file);
  };

  const handleCommitFare = () => {
    if (!fareOrigin.trim() || !fareDestination.trim() || fareRate <= 0) {
      return alert("Please provide the origin, destination, and valid fare amount.");
    }

    const desc = `${fareMode} Fare: ${fareOrigin.trim()} → ${fareDestination.trim()}`;
    addRow({
      qty: farePassengers,
      orsi: "NON-RECEIPTED FARE",
      desc: desc,
      subTotal: computedFareTotal
    });

    setFareOrigin("");
    setFareDestination("");
    setFarePassengers(1);
    setFareRate(0);
    setShowFareModal(false);
  };

  const handleAddReimbursement = () => {
    const reqName = requestor || "Officer";
    addRow({
      qty: 1,
      orsi: "OUT-OF-POCKET",
      desc: `Reimbursement Out-of-Pocket Expense (${reqName})`,
      subTotal: 0
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaRef) return alert("Select a Cash Advance reference ID or choose 'Direct Expense'.");
    if (expenseRows.length === 0 || totalExpense <= 0) return alert("Please add at least one valid expense item.");

    setIsSubmitting(true);
    try {
      await recordAudit(department, {
        date,
        advanceId: selectedCaRef === "DIRECT" ? "" : selectedCaRef,
        requestor,
        fundSource,
        budgetRequested,
        totalExpense,
        items: expenseRows,
        ay,
        term
      });

      alert("Liquidation successfully verified and recorded!");
      setSelectedCaRef("");
      setExpenseRows([{ id: "1", qty: 1, orsi: "", desc: "", subTotal: 0 }]);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="row g-2 mb-2">
          <div className="col-md-6">
            <label className="form-label text-secondary small fw-semibold">Liquidation Date</label>
            <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="col-md-6">
            <label className="form-label text-secondary small fw-semibold">Track Cash Advance Reference</label>
            <select className="form-select" value={selectedCaRef} onChange={e => setSelectedCaRef(e.target.value)} required>
              <option value="">-- Select Cash Advance Reference ID --</option>
              {pendingAdvances.map(ca => (
                <option key={ca.advanceId} value={ca.advanceId}>
                  [{ca.advanceId}] {ca.requestor} — {fmt(ca.amountApproved)} ({ca.fundSource})
                </option>
              ))}
              <option value="DIRECT">-- Direct Expense (No Prior CA) --</option>
            </select>
          </div>
        </div>

        <div className="row g-2 mb-2">
          <div className="col-md-6">
            <label className="form-label text-secondary small fw-semibold">Requestor / Officer</label>
            <input type="text" className="form-control text-secondary" value={requestor} readOnly />
          </div>
          <div className="col-md-6">
            <label className="form-label text-secondary small fw-semibold">Fund Pool</label>
            <select className="form-select" value={fundSource} onChange={e => setFundSource(e.target.value)} disabled={selectedCaRef !== "DIRECT" && selectedCaRef !== ""}>
              {funds.map(f => <option key={f.id} value={f.fundName}>{f.fundName}</option>)}
              <option value="General Fund (Carried Over)">General Fund (Carried Over)</option>
            </select>
          </div>
        </div>

        <div className="row g-2 mb-3">
          <div className="col-md-6">
            <label className="form-label text-secondary small fw-semibold">Approved Budget (₱)</label>
            <input type="number" step="0.01" className="form-control text-secondary" readOnly value={budgetRequested.toFixed(2)} />
          </div>
          <div className="col-md-6">
            <label className="form-label text-secondary small fw-semibold">Total Liquidated (₱)</label>
            <input type="number" step="0.01" className="form-control text-secondary" readOnly value={totalExpense.toFixed(2)} />
          </div>
        </div>

        {totalExpense > 0 && (
          <div className={`alert py-2 small mb-3 ${variance > 0 ? "alert-success" : variance < 0 ? "alert-danger" : "alert-info"}`}>
            {variance > 0 && <strong>SURPLUS / RETURN: {fmt(variance)} (To be returned to fund)</strong>}
            {variance < 0 && <strong>DEFICIT / REIMBURSEMENT: {fmt(Math.abs(variance))} (Owed to requestor)</strong>}
            {variance === 0 && <strong>EXACT LIQUIDATION (₱0.00 Variance)</strong>}
          </div>
        )}

        <h6 className="text-secondary fw-semibold">Itemized Receipts</h6>
        <div className="mb-3">
          {expenseRows.map((row) => (
            <div key={row.id} className="row g-2 mb-2 align-items-center">
              <div className="col-1">
                <input type="number" placeholder="Qty" className="form-control form-control-sm" min="1" value={row.qty} onChange={e => updateRow(row.id, 'qty', parseInt(e.target.value) || 1)} required />
              </div>
              <div className="col-2">
                <input type="text" placeholder="OR/SI #" className="form-control form-control-sm" value={row.orsi} onChange={e => updateRow(row.id, 'orsi', e.target.value)} />
              </div>
              <div className="col-3">
                <input type="text" placeholder="Description" className="form-control form-control-sm" value={row.desc} onChange={e => updateRow(row.id, 'desc', e.target.value)} required />
              </div>
              <div className="col-2">
                <input type="number" step="0.01" placeholder="Subtotal" className="form-control form-control-sm" value={row.subTotal || ""} onChange={e => updateRow(row.id, 'subTotal', parseFloat(e.target.value) || 0)} required />
              </div>
              <div className="col-3">
                <div className="input-group input-group-sm">
                  <input type="file" accept="image/*,application/pdf" className="form-control form-control-sm" onChange={e => handleFileChange(row.id, e)} />
                  <span className={`input-group-text border-secondary ${row.proofBase64 ? 'bg-success text-white' : 'text-secondary'}`} title={row.fileName || "No file attached"}>
                    <i className={`bi ${row.proofBase64 ? 'bi-check2' : 'bi-paperclip'}`}></i>
                  </span>
                </div>
              </div>
              <div className="col-1 text-end">
                <button type="button" className="btn btn-outline-danger btn-sm py-0" onClick={() => setExpenseRows(expenseRows.filter(r => r.id !== row.id))}>&times;</button>
              </div>
            </div>
          ))}
        </div>

        {/* Action Buttons (Add Item, Add Fare, Reimbursement)[cite: 5] */}
        <div className="d-flex gap-2 mb-3 flex-wrap">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => addRow()}>
            <i className="bi bi-plus-circle me-1"></i>+ Add Item
          </button>
          <button type="button" className="btn btn-outline-warning btn-sm fw-semibold" onClick={() => setShowFareModal(true)}>
            <i className="bi bi-bicycle me-1"></i>Add Fare
          </button>
          <button type="button" className="btn btn-outline-info btn-sm fw-semibold" onClick={handleAddReimbursement}>
            <i className="bi bi-wallet2 me-1"></i>Reimbursement
          </button>
        </div>

        <button type="submit" className="btn btn-info fw-bold w-100" disabled={isSubmitting}>
          {isSubmitting ? "Verifying..." : "Verify & Settle Liquidation"}
        </button>
      </form>

      {/* NON-RECEIPTED FARE MODAL[cite: 5] */}
      {showFareModal && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card border-secondary bg-dark text-white">
              <div className="modal-header border-secondary">
                <h5 className="modal-title text-warning"><i className="bi bi-signpost-2 me-2"></i>Non-Receipted Fare Particulars</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowFareModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="mb-2">
                  <label className="form-label text-secondary small fw-semibold">Conveyance / Mode</label>
                  <select className="form-select bg-card text-color border-secondary" value={fareMode} onChange={e => setFareMode(e.target.value)}>
                    <option value="Tricycle">Tricycle Fare</option>
                    <option value="Jeepney">Jeepney Fare</option>
                    <option value="Motorcycle / Habal-habal">Motorcycle / Habal-habal Fare</option>
                    <option value="Van / Bus">Van / Bus Fare</option>
                  </select>
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-6">
                    <label className="form-label text-secondary small fw-semibold">Origin / From</label>
                    <input type="text" className="form-control" placeholder="e.g. FCU Campus" value={fareOrigin} onChange={e => setFareOrigin(e.target.value)} required />
                  </div>
                  <div className="col-6">
                    <label className="form-label text-secondary small fw-semibold">Destination / To</label>
                    <input type="text" className="form-control" placeholder="e.g. Terminal" value={fareDestination} onChange={e => setFareDestination(e.target.value)} required />
                  </div>
                </div>
                <div className="row g-2 mb-2">
                  <div className="col-6">
                    <label className="form-label text-secondary small fw-semibold">Passenger Count / Qty</label>
                    <input type="number" className="form-control" value={farePassengers} min={1} onChange={e => setFarePassengers(parseInt(e.target.value) || 1)} />
                  </div>
                  <div className="col-6">
                    <label className="form-label text-secondary small fw-semibold">Fare per Passenger (₱)</label>
                    <input type="number" step="0.01" className="form-control" placeholder="0.00" value={fareRate || ""} onChange={e => setFareRate(parseFloat(e.target.value) || 0)} required />
                  </div>
                </div>
                <div className="alert alert-dark border-secondary py-2 small d-flex justify-content-between align-items-center mb-0">
                  <span>Computed Total:</span>
                  <strong className="text-warning fs-6">{fmt(computedFareTotal)}</strong>
                </div>
              </div>
              <div className="modal-footer border-secondary">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowFareModal(false)}>Cancel</button>
                <button type="button" className="btn btn-warning btn-sm fw-bold" onClick={handleCommitFare}>
                  <i className="bi bi-plus-lg me-1"></i>Insert Fare Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}