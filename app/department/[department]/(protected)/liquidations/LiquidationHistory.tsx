// /app/department/[department]/(protected)/liquidations/LiquidationHistory.tsx

"use client";
import { formatManilaDate, formatManilaLongDate } from '@/lib/clear-timezone';
import { clearAlert, clearConfirm, clearPrompt } from "@/lib/clear-dialogs";


import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { fmt } from "@/lib/utils";
import { saveReportSettings, saveSignatories } from "../../actions";
import { executeVoidTransaction } from "../void/actions";
import SavePdfButton from "../../components/SavePdfButton";

export default function LiquidationHistory({
  audits,
  orgName,
  logoUrl,
  signatories: initialSignatories,
  ay,
  term,
  department,
  orgId,
  schoolName: suppliedSchoolName = "",
  schoolAddress: suppliedSchoolAddress = "",
  reportSchoolName = "",
  reportSchoolAddress = "",
  reportHeaderLeftLogo = "",
  reportHeaderRightLogo = "",
  settingsManagedByParent = false,
  canVoid = false,
  isClosed = false,
}: any) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [printData, setPrintData] = useState<any>(null);
  const [voidingAudit, setVoidingAudit] = useState<string | null>(null);
  const reverseAudit = async (audit: any) => {
    if (!canVoid || isClosed || voidingAudit) return;
    const reason = await clearPrompt(`Explain the reversal of audited liquidation ${audit.auditId}. Original expense items will be retained.`,
      { title: "Void Audited Liquidation", multiline: true, confirmText: "Continue" });
    if (reason === null) return;
    if (reason.trim().length < 5) return void clearAlert("The reason must contain at least 5 characters.");
    if (!await clearConfirm(`Void ${audit.auditId}? A linked cash advance will become Pending Liquidation again.`,
      { title: "Confirm Liquidation Reversal", confirmText: "Void Liquidation" })) return;
    setVoidingAudit(audit.id);
    try {
      await executeVoidTransaction({ department, category: "liquidations", referenceId: audit.auditId,
        ay, term, reason: reason.trim() });
      await clearAlert("Liquidation reversed; records and audit trail retained.", "success");
      router.refresh();
    } catch (e: any) { await clearAlert(e?.message || "Failed to void liquidation.", "error"); }
    finally { setVoidingAudit(null); }
  };
  const [showSettings, setShowSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [signatories, setSignatories] = useState(initialSignatories || []);
  const [schoolName, setSchoolName] = useState(String(reportSchoolName || suppliedSchoolName || ""));
  const [schoolAddress, setSchoolAddress] = useState(String(reportSchoolAddress || suppliedSchoolAddress || ""));
  const [leftLogoFile, setLeftLogoFile] = useState<File | null>(null);
  const [rightLogoFile, setRightLogoFile] = useState<File | null>(null);

  // When the parent owns Report Settings, use the latest saved props directly.
  const printSchoolName = settingsManagedByParent
    ? String(reportSchoolName || suppliedSchoolName || "")
    : schoolName;
  const printSchoolAddress = settingsManagedByParent
    ? String(reportSchoolAddress || suppliedSchoolAddress || "")
    : schoolAddress;
  const printSignatories = settingsManagedByParent ? initialSignatories : signatories;

  const labelOptions = ["Prepared by:", "Attested by:", "Noted by:", "Endorsed by:", "Verified by:", "Approved by:"];

  const handleUpdateSignatory = (index: number, field: string, value: string) => {
    setSignatories((current: any[]) => current.map((sig, i) => i === index ? { ...sig, [field]: value } : sig));
  };

  const handleAddSignatory = () => {
    setSignatories((current: any[]) => [...current, { label: "Prepared by:", name: "", position: "" }]);
  };

  const handleRemoveSignatory = (index: number) => {
    setSignatories((current: any[]) => current.filter((_: any, i: number) => i !== index));
  };

  const handleSaveReportSettings = async () => {
    if (!department) {
      void clearAlert("Unable to save report settings because the department identifier was not provided by the page.");
      return;
    }
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("schoolName", schoolName.trim());
      formData.append("schoolAddress", schoolAddress.trim());
      if (leftLogoFile) formData.append("leftLogo", leftLogoFile);
      if (rightLogoFile) formData.append("rightLogo", rightLogoFile);
      await saveReportSettings(department, formData);
      await saveSignatories(orgId, department, signatories);
      setLeftLogoFile(null);
      setRightLogoFile(null);
      setShowSettings(false);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      void clearAlert(`Failed to save report settings: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // =================================================================
  // EXPORT CSV LOGIC
  // =================================================================
  const handleExportCSV = (audit: any) => {
    const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const headers = ["Quantity", "OR/SI Number", "Description", "Subtotal (PHP)"];
    const rows = (Array.isArray(audit.items) ? audit.items : []).map((item: any) =>
      [item.qty, item.orSiNumber || "N/A", item.description || "", Number(item.subTotal || 0).toFixed(2)]
        .map(csvCell).join(",")
    );
    const content = [headers.map(csvCell).join(","), ...rows].join("\r\n");
    const blob = new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Liquidation_${String(audit.auditId || "record").replace(/[^a-zA-Z0-9_-]/g, "_")}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  // =================================================================
  // PRINT LOGIC
  // =================================================================
  const handlePrint = (audit: any) => {
    setPrintData(audit);
    // Increased delay to 500ms to guarantee React paints the hidden DOM completely before printing
    setTimeout(() => {
      window.print();
    }, 500); 
  };

  if (!audits || audits.length === 0) {
    return (
      <div className="text-center text-muted py-5 mt-4">
        <i className="bi bi-folder-x fs-1 d-block mb-3 opacity-50"></i>
        No audited liquidations found for this term.
      </div>
    );
  }

  return (
    <>
      {/* BULLETPROOF PRINT STYLESHEET */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: 8.5in 13in; margin: 0.5in; }
          
          /* Hides standard app layout elements */
          aside, nav, header, footer, .sidebar, .d-print-none { 
            display: none !important; 
          }

          /* CRITICAL FIX: Force every single element to allow overflow so nothing gets cut off */
          * {
            overflow: visible !important;
          }
          
          /* CRITICAL FIX: Reset layout for natural multi-page flow and kill the card overflow-hidden */
          html, body, main, #__next, .layout-wrapper, .card, .module, .card-body {
            margin: 0 !important; padding: 0 !important; width: 100% !important; 
            height: auto !important; min-height: auto !important; background-color: white !important;
            position: static !important;
            box-shadow: none !important; border: none !important;
          }
          
          /* GUARANTEE PRINT CONTAINER IS VISIBLE AND STATIC */
          .print-container {
            display: block !important;
            visibility: visible !important;
            position: static !important; 
            width: 100% !important; margin: 0 !important; padding: 0 !important; 
            border: none !important; box-shadow: none !important; background-color: white !important;
          }
          
          .print-container * { color: #000000 !important; background-color: transparent !important; }
          .print-container .bg-dark { background-color: #f8f9fa !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          
          .print-container table { border-collapse: collapse !important; margin-bottom: 15px !important; width: 100% !important; }
          .print-container th, .print-container td { border: 1px solid #000000 !important; padding: 5px 8px !important; }
          
          .print-container thead { display: table-header-group !important; }
          .print-container tr { page-break-inside: avoid !important; }
          .signature-block { margin-top: 40px !important; page-break-inside: avoid !important; }
        }
      `}} />

      {!settingsManagedByParent && (
        <div className="d-flex justify-content-end mb-3 d-print-none">
          <button className="btn btn-outline-info btn-sm fw-bold" onClick={() => setShowSettings(true)}>
            <i className="bi bi-gear-fill me-1"></i>Report Settings
          </button>
        </div>
      )}

      <div className="table-responsive d-print-none text-body">
        <table className="table table-hover align-middle mb-0" style={{ fontSize: '0.9rem' }}>
          <thead>
            <tr className="text-muted small border-bottom border-secondary">
              <th>Audit Ref</th>
              <th>Date Liquidated</th>
              <th>Requestor</th>
              <th className="text-end">Amount Expensed</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {audits.map((audit: any) => (
              <React.Fragment key={audit.id}>
                {/* PRIMARY ROW */}
                <tr className="border-bottom border-secondary">
                  <td className="fw-bold text-info">{audit.auditId}
                    {/VOID|CANCEL/i.test(String(audit.status || "")) &&
                      <span className="badge text-bg-secondary ms-2">Voided</span>}
                  </td>
                  <td>{formatManilaDate(audit.date)}</td>
                  <td className="fw-semibold">{audit.requestor}</td>
                  <td className="text-end fw-bold text-danger">{fmt(audit.totalExpense as any)}</td>
                  <td className="text-center">
                    <button 
                      className="btn btn-sm btn-outline-secondary me-2"
                      onClick={() => setExpandedId(expandedId === audit.id ? null : audit.id)}
                      title="View Audited Report"
                    >
                      <i className={`bi ${expandedId === audit.id ? 'bi-eye-slash-fill' : 'bi-eye-fill'}`}></i> View
                    </button>
                    <button className="btn btn-sm btn-outline-info me-2" onClick={() => handleExportCSV(audit)} title="Export Items to CSV">
                      <i className="bi bi-filetype-csv"></i>
                    </button>
                    {canVoid && !isClosed && !/VOID|CANCEL/i.test(String(audit.status || "")) && (
                      <button type="button" className="btn btn-sm btn-outline-danger me-2"
                        disabled={Boolean(voidingAudit)} onClick={() => reverseAudit(audit)}
                        title="Void audited liquidation (authorized users only)">
                        {voidingAudit === audit.id ? "Voiding..." : "Void"}
                      </button>
                    )}
                    <button className="btn btn-sm btn-outline-primary" onClick={() => handlePrint(audit)} title="Print Audited Report">
                      <i className="bi bi-printer-fill"></i> Print
                    </button>
                    <SavePdfButton className="btn btn-sm btn-outline-danger ms-1" label="PDF" onClick={() => handlePrint(audit)} />
                  </td>
                </tr>
                
                {/* EXPANDED ITEMS DETAIL */}
                {expandedId === audit.id && (
                  <tr>
                    <td colSpan={5} className="p-0 border-0">
                      <div className="bg-body-secondary p-3 border-bottom border-secondary shadow-inner">
                        
                        <div className="row mb-3 small text-muted">
                          <div className="col-md-6">
                            <div><strong className="text-body">Fund Source / Purpose:</strong> {audit.fundSource}</div>
                            <div><strong className="text-body">Reference ID:</strong> <span className="text-info">{audit.referenceCaId || audit.advanceId || 'N/A'}</span></div>
                          </div>
                          <div className="col-md-6 text-md-end">
                            <div><strong className="text-body">Amount Requested (Budget):</strong> {fmt(audit.budgetRequested as any)}</div>
                            <div>
                              <strong className="text-body">Audit Result: </strong>
                              {Number(audit.varianceReturn) > 0 ? (
                                <span className="text-success fw-bold">Cash Returned: {fmt(audit.varianceReturn as any)}</span>
                              ) : Number(audit.reimbursementDue) > 0 ? (
                                <span className="text-danger fw-bold">Reimbursement Due: {fmt(audit.reimbursementDue as any)}</span>
                              ) : (
                                <span className="text-secondary fw-bold">Exact Match (No Variance)</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <table className="table table-sm table-bordered mb-0 bg-body text-body">
                          <thead className="table-secondary small">
                            <tr>
                              <th style={{ width: '10%' }}>Qty</th>
                              <th style={{ width: '25%' }}>OR/SI #</th>
                              <th>Description of Item</th>
                              <th className="text-end" style={{ width: '20%' }}>SubTotal</th>
                            </tr>
                          </thead>
                          <tbody className="small">
                            {audit.items.map((item: any) => (
                              <tr key={item.id}>
                                <td>{item.qty}</td>
                                <td className="font-monospace text-muted">{item.orSiNumber || '-'}</td>
                                <td>{item.description}</td>
                                <td className="text-end">{fmt(item.subTotal as any)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* =================================================================
          HIDDEN PRINT TEMPLATE (Activated via window.print)
      ================================================================= */}
      {printData && (
        <div className="print-container d-none d-print-block">
          
          {/* INSTITUTIONAL HEADER: use saved report settings instead of hard-coded branding */}
          <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-dark">
            <div style={{ width: '90px', minWidth: '90px', flexShrink: 0 }} className="text-center">
              {reportHeaderLeftLogo ? (
                <img src={reportHeaderLeftLogo} alt="School logo" style={{ width: '100%', maxHeight: '90px', objectFit: 'contain' }} />
              ) : <div aria-hidden="true" />}
            </div>
            <div className="text-center flex-grow-1 px-3">
              {printSchoolName.trim() ? <div className="fw-bold text-uppercase" style={{ fontSize: '1.1rem' }}>{printSchoolName.trim()}</div> : null}
              <div className="fw-bold text-uppercase" style={{ fontSize: '0.9rem' }}>{orgName}</div>
              {printSchoolAddress.trim() ? <div className="small">{printSchoolAddress.trim()}</div> : null}
              <div className="mt-3 fw-bold text-uppercase" style={{ fontSize: '0.95rem' }}>OFFICIAL AUDITED LIQUIDATION REPORT</div>
              <div className="small mt-1">{ay} &nbsp;|&nbsp; {term}</div>
            </div>
            <div style={{ width: '90px', minWidth: '90px', flexShrink: 0 }} className="text-center">
              {(reportHeaderRightLogo || logoUrl) ? (
                <img src={reportHeaderRightLogo || logoUrl} alt="Organization logo" style={{ width: '100%', maxHeight: '90px', objectFit: 'contain' }} />
              ) : <div aria-hidden="true" />}
            </div>
          </div>

          {/* AUDIT METADATA */}
          <div className="row mb-3 mt-4 small">
            <div className="col-6">
              <div className="mb-1"><strong>Audit ID:</strong> <span className="font-monospace">{printData.auditId}</span></div>
              <div className="mb-1"><strong>Date Liquidated:</strong> {formatManilaLongDate(printData.date)}</div>
              <div className="mb-1"><strong>Requestor:</strong> <span className="text-uppercase fw-semibold">{printData.requestor}</span></div>
            </div>
            <div className="col-6 text-end">
              <div className="mb-1"><strong>Reference ID:</strong> <span className="font-monospace">{printData.referenceCaId || printData.advanceId || 'N/A'}</span></div>
              <div className="mb-1"><strong>Fund Source / Purpose:</strong> {printData.fundSource}</div>
            </div>
          </div>

          {/* ITEMIZED EXPENSES TABLE */}
          <table className="table table-sm mt-3 border-dark">
            <thead className="bg-dark text-dark text-uppercase small">
              <tr>
                <th className="text-center" style={{ width: '8%' }}>Qty</th>
                <th style={{ width: '25%' }}>OR / SI No.</th>
                <th>Itemized Particulars</th>
                <th className="text-end" style={{ width: '20%' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {printData.items.map((item: any, idx: number) => (
                <tr key={idx}>
                  <td className="text-center">{item.qty}</td>
                  <td className="font-monospace">{item.orSiNumber || 'N/A'}</td>
                  <td>{item.description}</td>
                  <td className="text-end">{fmt(item.subTotal as any)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {/* SUMMARY CALCULATIONS */}
              <tr>
                <td colSpan={3} className="text-end small py-1 pt-3">AMOUNT REQUESTED (BUDGET):</td>
                <td className="text-end small pt-3">{fmt(printData.budgetRequested as any)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="text-end fw-bold py-1">TOTAL LIQUIDATED AMOUNT:</td>
                <td className="text-end fw-bold text-decoration-underline text-danger">{fmt(printData.totalExpense as any)}</td>
              </tr>
              <tr>
                <td colSpan={3} className="text-end fw-bold py-1 pb-3">
                  {Number(printData.varianceReturn) > 0 ? 'CASH RETURNED (SURPLUS):' : 
                   Number(printData.reimbursementDue) > 0 ? 'AMOUNT TO BE REIMBURSED:' : 
                   'NET VARIANCE:'}
                </td>
                <td className="text-end fw-bold pb-3">
                  {Number(printData.varianceReturn) > 0 ? fmt(printData.varianceReturn as any) : 
                   Number(printData.reimbursementDue) > 0 ? fmt(printData.reimbursementDue as any) : 
                   '₱0.00'}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* DYNAMIC SIGNATORIES */}
          <div className="row mt-5 text-center signature-block small">
            {printSignatories && printSignatories.length > 0 ? (
              printSignatories.map((sig: any, idx: number) => (
                <div className="col" key={idx}>
                  <div className="text-muted mb-1" style={{ fontSize: '0.75rem' }}>{sig.label}</div>
                  <div style={{ height: '40px' }}></div>
                  <div className="fw-bold border-top border-dark pt-1 px-2">{sig.name || "________________"}</div>
                  <div className="text-muted" style={{ fontSize: '0.7rem' }}>{sig.position || "Position"}</div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted small w-100 mt-4">
                <em>Signatories have not been configured for this department yet.</em>
              </div>
            )}
          </div>

        </div>
      )}

      {!settingsManagedByParent && showSettings && (
        <div className="modal fade show d-block d-print-none" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1080 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div className="modal-content bg-body border-secondary text-body shadow-lg clear-theme-modal">
              <div className="modal-header border-secondary">
                <h5 className="modal-title fw-bold text-info"><i className="bi bi-gear-fill me-2"></i>Report Settings</h5>
                <button type="button" className="btn-close" onClick={() => setShowSettings(false)} aria-label="Close"></button>
              </div>
              <div className="modal-body p-4">
                <p className="small text-muted mb-3">These settings are shared by the Summary, Reports, and Audited Liquidation History printouts.</p>
                <div className="border border-secondary rounded p-3 mb-4">
                  <h6 className="fw-bold text-info mb-3">Institution / Print Header</h6>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">School Name</label>
                    <input className="form-control bg-body text-body border-secondary" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Enter school or institution name" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Organization / Department Name</label>
                    <input className="form-control bg-body-secondary text-body border-secondary" value={orgName || ""} readOnly />
                    <div className="form-text">This is the registered organization name and is retained on the printout.</div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">School Address</label>
                    <textarea className="form-control bg-body text-body border-secondary" value={schoolAddress} onChange={(e) => setSchoolAddress(e.target.value)} rows={2} placeholder="Enter school address" />
                  </div>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Left Header Logo</label>
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="form-control form-control-sm bg-body text-body border-secondary" onChange={(e) => setLeftLogoFile(e.target.files?.[0] || null)} />
                      {reportHeaderLeftLogo && <div className="small text-muted mt-1">A left logo is already saved. Upload a new file to replace it.</div>}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Right Header Logo</label>
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="form-control form-control-sm bg-body text-body border-secondary" onChange={(e) => setRightLogoFile(e.target.files?.[0] || null)} />
                      {(reportHeaderRightLogo || logoUrl) && <div className="small text-muted mt-1">A right logo is already available. Upload a new file to replace it.</div>}
                    </div>
                  </div>
                </div>

                <h6 className="fw-bold text-info mb-3">Report Signatories</h6>
                {signatories.map((sig: any, idx: number) => (
                  <div className="row g-2 mb-3 align-items-center bg-body-secondary p-2 rounded border border-secondary" key={idx}>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Action / Label</label>
                      <select className="form-select form-select-sm bg-body text-body border-secondary" value={sig.label || "Prepared by:"} onChange={(e) => handleUpdateSignatory(idx, "label", e.target.value)}>
                        {labelOptions.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Full Name</label>
                      <input className="form-control form-control-sm bg-body text-body border-secondary" value={sig.name || ""} onChange={(e) => handleUpdateSignatory(idx, "name", e.target.value)} placeholder="Full name" />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Position / Title</label>
                      <input className="form-control form-control-sm bg-body text-body border-secondary" value={sig.position || ""} onChange={(e) => handleUpdateSignatory(idx, "position", e.target.value)} placeholder="Position or title" />
                    </div>
                    <div className="col-md-1 text-end mt-4">
                      <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => handleRemoveSignatory(idx)} title="Remove signatory"><i className="bi bi-trash"></i></button>
                    </div>
                  </div>
                ))}
                <button type="button" className="btn btn-outline-secondary btn-sm w-100 fw-bold mt-2" onClick={handleAddSignatory}><i className="bi bi-plus-lg me-1"></i>Add Signatory</button>
              </div>
              <div className="modal-footer border-secondary">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                  setSignatories(initialSignatories || []);
                  setSchoolName(String(reportSchoolName || suppliedSchoolName || ""));
                  setSchoolAddress(String(reportSchoolAddress || suppliedSchoolAddress || ""));
                  setLeftLogoFile(null);
                  setRightLogoFile(null);
                  setShowSettings(false);
                }}>Cancel</button>
                <button type="button" className="btn btn-info btn-sm text-dark fw-bold" onClick={handleSaveReportSettings} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Report Settings"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}