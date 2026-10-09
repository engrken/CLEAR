"use client";

import { useState } from "react";
import { fmt } from "@/lib/utils";
import { transferFunds, carryOverTermBalance } from "./actions";
import { ThemedAlert } from '@/lib/alerts';

interface Fund { name: string; balance: number; }

// Pre-defined Academic Years for the dropdown
const AY_OPTIONS = [
  "A.Y. 2029 - 2030",
  "A.Y. 2028 - 2029",
  "A.Y. 2027 - 2028",
  "A.Y. 2026 - 2027",
  "A.Y. 2025 - 2026"
];

export default function RealignManager({
  department,
  ay,
  term,
  funds
}: {
  department: string;
  ay: string;
  term: string;
  funds: Fund[];
}) {
  // Inter-Fund Transfer Form State
  const [fromFund, setFromFund] = useState(funds[0]?.name || "");
  const [toFund, setToFund] = useState(funds[1]?.name || funds[0]?.name || "");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferReason, setTransferReason] = useState("");

  // Carry Over Form State
  const [carrySourceAY, setCarrySourceAY] = useState("A.Y. 2026 - 2027");
  const [carrySourceTerm, setCarrySourceTerm] = useState("2nd Sem");
  const [carryAmount, setCarryAmount] = useState("");
  const [carryReason, setCarryReason] = useState(`Carried over remaining balance into General Fund of ${term} (${ay})`);

  // Preview Modal State
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState<{
    title: string;
    desc: string;
    sourceName: string;
    sourceOldBal: number;
    sourceNewBal: number;
    destName: string;
    destOldBal: number;
    destNewBal: number;
    amount: number;
    isTransfer: boolean;
  } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle Transfer Preview Click
  const handleOpenTransferPreview = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(transferAmount) || 0;

    if (fromFund === toFund) return alert("Source and destination fund accounts cannot be identical.");
    if (amt <= 0) return alert("Transfer amount must be greater than ₱0.00.");

    const fromObj = funds.find(f => f.name === fromFund) || { balance: 0 };
    const toObj = funds.find(f => f.name === toFund) || { balance: 0 };

    setPreviewData({
      title: "Inter-Fund Realignment Preview",
      desc: `Transferring funds within the active term (${term}).`,
      sourceName: fromFund,
      sourceOldBal: fromObj.balance,
      sourceNewBal: fromObj.balance - amt,
      destName: toFund,
      destOldBal: toObj.balance,
      destNewBal: toObj.balance + amt,
      amount: amt,
      isTransfer: true
    });
    setShowPreviewModal(true);
  };

  // Handle Carry-Over Preview Click
  const handleOpenCarryPreview = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(carryAmount) || 0;

    if (amt <= 0) return alert("Carry-over amount must be greater than ₱0.00.");

    const genFundObj = funds.find(f => f.name === "General Fund (Carried Over)") || { balance: 0 };

    setPreviewData({
      title: "Term Balance Carry-Over Preview",
      desc: `Forwarding remaining balance from ${carrySourceTerm} (${carrySourceAY}) into ${term} (${ay}).`,
      sourceName: `${carrySourceTerm} (${carrySourceAY})`,
      sourceOldBal: amt,
      sourceNewBal: 0,
      destName: "General Fund (Carried Over)",
      destOldBal: genFundObj.balance,
      destNewBal: genFundObj.balance + amt,
      amount: amt,
      isTransfer: false
    });
    setShowPreviewModal(true);
  };

  // Execute Confirmed Realignment Action
  const handleExecuteConfirmed = async () => {
    if (!previewData) return;

    setIsSubmitting(true);
    try {
      if (previewData.isTransfer) {
        await transferFunds(department, {
          fromFund,
          toFund,
          amount: previewData.amount,
          reason: transferReason || "Inter-fund realignment",
          ay,
          term
        });
        alert("Inter-fund realignment executed successfully!");
        setTransferAmount("");
        setTransferReason("");
      } else {
        await carryOverTermBalance(department, {
          sourceAY: carrySourceAY,
          sourceTerm: carrySourceTerm,
          destAY: ay,
          destTerm: term,
          amount: previewData.amount,
          reason: carryReason,
        });
        alert("Term balance successfully carried over!");
        setCarryAmount("");
      }
      setShowPreviewModal(false);
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="row g-4">
        {/* 1. INTER-FUND REALIGNMENT FORM */}
        <div className="col-12 col-lg-6">
          <div className="card p-3 border-secondary h-100 shadow-sm">
            <h6 className="text-accent fw-bold mb-3"><i className="bi bi-arrow-repeat me-2"></i>Inter-Fund Realignment</h6>
            <form onSubmit={handleOpenTransferPreview}>
              <div className="mb-2">
                <label className="form-label text-secondary small fw-semibold">Source Fund Pool</label>
                <select className="form-select" value={fromFund} onChange={e => setFromFund(e.target.value)} required>
                  {funds.map(f => <option key={f.name} value={f.name}>{f.name} (Bal: {fmt(f.balance)})</option>)}
                </select>
              </div>

              <div className="mb-2">
                <label className="form-label text-secondary small fw-semibold">Destination Fund Pool</label>
                <select className="form-select" value={toFund} onChange={e => setToFund(e.target.value)} required>
                  {funds.map(f => <option key={f.name} value={f.name}>{f.name} (Bal: {fmt(f.balance)})</option>)}
                </select>
              </div>

              <div className="mb-2">
                <label className="form-label text-secondary small fw-semibold">Transfer Amount (₱)</label>
                <input type="number" step="0.01" className="form-control" value={transferAmount} onChange={e => setTransferAmount(e.target.value)} required />
              </div>

              <div className="mb-3">
                <label className="form-label text-secondary small fw-semibold">Reason / Justification</label>
                <input type="text" className="form-control" placeholder="e.g. Budget reallocation for event logistics" value={transferReason} onChange={e => setTransferReason(e.target.value)} required />
              </div>

              <button type="submit" className="btn btn-info fw-bold w-100">Preview & Execute Transfer</button>
            </form>
          </div>
        </div>

        {/* 2. TERM BALANCE CARRY OVER FORM */}
        <div className="col-12 col-lg-6">
          <div className="card p-3 border-secondary h-100 shadow-sm">
            <h6 className="text-warning fw-bold mb-3"><i className="bi bi-box-arrow-in-right me-2"></i>Term Balance Carry-Over</h6>
            <form onSubmit={handleOpenCarryPreview}>
              <div className="row g-2 mb-2">
                <div className="col-6">
                  <label className="form-label text-secondary small fw-semibold">Source Academic Year</label>
                  <select 
                    className="form-select" 
                    value={carrySourceAY} 
                    onChange={e => setCarrySourceAY(e.target.value)} 
                    required
                  >
                    {AY_OPTIONS.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
                <div className="col-6">
                  <label className="form-label text-secondary small fw-semibold">Source Term</label>
                  <select className="form-select" value={carrySourceTerm} onChange={e => setCarrySourceTerm(e.target.value)}>
                    <option value="1st Sem">1st Sem</option>
                    <option value="2nd Sem">2nd Sem</option>
                    <option value="Summer">Summer</option>
                  </select>
                </div>
              </div>

              <div className="mb-2">
                <label className="form-label text-secondary small fw-semibold">Amount to Forward (₱)</label>
                <input type="number" step="0.01" className="form-control" value={carryAmount} onChange={e => setCarryAmount(e.target.value)} required />
              </div>

              <div className="mb-3">
                <label className="form-label text-secondary small fw-semibold">Carry-Over Notes</label>
                <input type="text" className="form-control" value={carryReason} onChange={e => setCarryReason(e.target.value)} required />
              </div>

              <button type="submit" className="btn btn-warning fw-bold w-100">Preview Carry-Over</button>
            </form>
          </div>
        </div>
      </div>

      {/* CONFIRMATION PREVIEW MODAL */}
      {showPreviewModal && previewData && (
        <div className="modal fade show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card border-secondary bg-dark text-white">
              <div className="modal-header border-secondary">
                <h5 className="modal-title text-accent"><i className="bi bi-eye me-2"></i>{previewData.title}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowPreviewModal(false)}></button>
              </div>
              <div className="modal-body">
                <p className="text-secondary small mb-3">{previewData.desc}</p>
                
                <div className="table-responsive mb-3">
                  <table className="table table-sm align-middle text-white">
                    <thead>
                      <tr className="text-secondary small border-bottom border-secondary">
                        <th>Account Pool</th><th className="text-end">Current</th><th className="text-end">Adjustment</th><th className="text-end">Projected</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>{previewData.sourceName}</strong></td>
                        <td className="text-end">{fmt(previewData.sourceOldBal)}</td>
                        <td className="text-end text-danger">-{fmt(previewData.amount)}</td>
                        <td className={`text-end fw-bold ${previewData.sourceNewBal < 0 ? 'text-danger' : 'text-success'}`}>{fmt(previewData.sourceNewBal)}</td>
                      </tr>
                      <tr>
                        <td><strong>{previewData.destName}</strong></td>
                        <td className="text-end">{fmt(previewData.destOldBal)}</td>
                        <td className="text-end text-success">+{fmt(previewData.amount)}</td>
                        <td className="text-end fw-bold text-success">{fmt(previewData.destNewBal)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {previewData.sourceNewBal < 0 && (
                  <div className="alert alert-danger py-2 small mb-0">
                    <i className="bi bi-exclamation-triangle-fill me-1"></i>Warning: Source pool will result in a negative balance.
                  </div>
                )}
              </div>
              <div className="modal-footer border-secondary">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPreviewModal(false)}>Cancel</button>
                <button type="button" className="btn btn-info btn-sm fw-bold" onClick={handleExecuteConfirmed} disabled={isSubmitting}>
                  {isSubmitting ? "Executing..." : "Confirm & Execute"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}