// (protected)/liquidations/LiquidationsClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveSignatories } from "../../actions";
import LiquidationsForm from "./LiquidationsForm";
import LiquidationHistory from "./LiquidationHistory";

export default function LiquidationsClient({
  orgId,
  department,
  orgName,
  logoUrl,
  signatories: initialSignatories,
  ay,
  term,
  pendingAdvances,
  funds,
  prefillCaId,
  pastAudits,
}: any) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

  // =========================================================
  // SIGNATORIES SETUP STATE
  // =========================================================
  const [showSettings, setShowSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [signatories, setSignatories] = useState(initialSignatories || []);
  
  const labelOptions = ["Prepared by:", "Attested by:", "Noted by:", "Endorsed by:", "Verified by:", "Approved by:"];

  const handleAddSignatory = () => setSignatories([...signatories, { label: "Prepared by:", name: "", position: "" }]);
  
  const handleUpdateSignatory = (index: number, field: string, value: string) => {
    const updated = [...signatories];
    updated[index] = { ...updated[index], [field]: value };
    setSignatories(updated);
  };
  
  const handleRemoveSignatory = (index: number) => setSignatories(signatories.filter((_: any, i: number) => i !== index));

  const handleSaveSignatories = async () => {
    setIsSaving(true);
    try {
      await saveSignatories(orgId, department, signatories);
      setShowSettings(false);
      router.refresh();
    } catch (error) {
      alert("Failed to save signatories.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      {/* TABS HEADER */}
      <div className="card-header bg-body border-bottom border-secondary pt-3 px-3 px-md-4 d-print-none d-flex justify-content-between align-items-end flex-wrap gap-2">
        <ul className="nav nav-tabs border-bottom-0" role="tablist">
          <li className="nav-item" role="presentation">
            <button
              className={`nav-link fw-bold ${activeTab === "pending" ? "active text-info border-secondary border-bottom-0 bg-body" : "text-muted border-transparent bg-transparent"}`}
              onClick={() => setActiveTab("pending")}
              type="button"
            >
              <i className="bi bi-file-earmark-text me-2"></i>
              Pending Advances & Audit Form
            </button>
          </li>
          <li className="nav-item" role="presentation">
            <button
              className={`nav-link fw-bold ${activeTab === "history" ? "active text-info border-secondary border-bottom-0 bg-body" : "text-muted border-transparent bg-transparent"}`}
              onClick={() => setActiveTab("history")}
              type="button"
            >
              <i className="bi bi-clock-history me-2"></i>
              Audited Liquidation History
            </button>
          </li>
        </ul>
        
        {/* REPORT SETTINGS BUTTON */}
        <button className="btn btn-outline-info btn-sm fw-bold mb-2" onClick={() => setShowSettings(true)}>
          <i className="bi bi-gear-fill me-1"></i>Report Settings
        </button>
      </div>

      {/* TABS CONTENT */}
      <div className="card-body p-0 bg-body">
        {activeTab === "pending" ? (
          <div className="p-3 p-md-4">
            <LiquidationsForm
              department={department}
              ay={ay}
              term={term}
              pendingAdvances={pendingAdvances}
              funds={funds}
              prefillCaId={prefillCaId}
            />
          </div>
        ) : (
          <div className="p-3 p-md-4">
            <LiquidationHistory
              audits={pastAudits}
              orgName={orgName}
              logoUrl={logoUrl}
              signatories={signatories} // <--- Passed dynamically so it updates instantly
              ay={ay}
              term={term}
            />
          </div>
        )}
      </div>

      {/* =========================================================
          REPORT SETTINGS MODAL
      ========================================================= */}
      {showSettings && (
        <div className="modal fade show d-block d-print-none" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content bg-body border-secondary text-body shadow-lg">
              <div className="modal-header border-secondary">
                <h5 className="modal-title fw-bold text-info">
                  <i className="bi bi-pen-fill me-2"></i>Configure Signatories
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowSettings(false)}></button>
              </div>
              <div className="modal-body p-4">
                <p className="small text-muted mb-3">
                  Customize the official signatories for this department. These will appear at the bottom of the Audited Liquidation reports.
                </p>

                {signatories.map((sig: any, idx: number) => (
                  <div key={idx} className="row g-2 mb-3 align-items-center bg-body-secondary p-2 rounded border border-secondary">
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold text-muted mb-1">Action / Label</label>
                      <select 
                        className="form-select form-select-sm bg-body text-body border-secondary" 
                        value={sig.label} 
                        onChange={(e) => handleUpdateSignatory(idx, 'label', e.target.value)}
                      >
                        {labelOptions.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold text-muted mb-1">Full Name</label>
                      <input 
                        type="text" 
                        className="form-control form-control-sm bg-body text-body border-secondary" 
                        placeholder="e.g. Juan Dela Cruz" 
                        value={sig.name} 
                        onChange={(e) => handleUpdateSignatory(idx, 'name', e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold text-muted mb-1">Position / Title</label>
                      <input 
                        type="text" 
                        className="form-control form-control-sm bg-body text-body border-secondary" 
                        placeholder="e.g. Internal Auditor" 
                        value={sig.position} 
                        onChange={(e) => handleUpdateSignatory(idx, 'position', e.target.value)}
                      />
                    </div>
                    <div className="col-md-1 text-end mt-4">
                      <button className="btn btn-outline-danger btn-sm" onClick={() => handleRemoveSignatory(idx)} title="Remove">
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                ))}

                <button className="btn btn-outline-secondary btn-sm w-100 fw-bold border-dashed mt-2" onClick={handleAddSignatory}>
                  <i className="bi bi-plus-lg me-1"></i> Add Signatory
                </button>
              </div>
              <div className="modal-footer border-secondary">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                  setSignatories(initialSignatories); 
                  setShowSettings(false);
                }}>Cancel</button>
                <button type="button" className="btn btn-info btn-sm text-dark fw-bold" onClick={handleSaveSignatories} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Signatories"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}