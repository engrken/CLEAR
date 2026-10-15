// /app/department/[department]/(protected)/summary/SummaryClient.tsx

"use client";

import { useState, useEffect } from "react";
import { fmt } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { saveSignatories } from "../../actions";

export default function SummaryClient({
  department,
  orgId,
  orgName,
  logoUrl,
  initialSignatories,
  ay,
  term,
  termPkg,
  collectionHierarchy,
  grandCollectionTotal,
  expensesByFund,
  grandExpenseTotal,
  collectibles,
  totalCollectiblesSum,
  cashierBalance,
  totalDeposited,
  totalWithdrawn,
  remainingBalance
}: any) {
  const router = useRouter();
  // 🚀 Use centralized engine remainingBalance (incorporates initial funds, rollovers, and unliquidated advances)
  const netBalance = remainingBalance !== undefined ? remainingBalance : (grandCollectionTotal - grandExpenseTotal);
  const safeBalance = cashierBalance || 0;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const getAssetUrl = (filename: string) => {
    if (mounted && window.location.hostname.endsWith('.localhost')) {
      return `http://localhost:${window.location.port}/${filename}`;
    }
    return `/${filename}`;
  };

  const displayLogo = logoUrl || getAssetUrl('engineering_logo.png');

  const [showSettings, setShowSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [signatories, setSignatories] = useState(initialSignatories || []);
  const labelOptions = ["Prepared by:", "Attested by:", "Noted by:", "Endorsed by:", "Verified by:", "Approved by:"];

  const handleAddSignatory = () => {
    setSignatories([...signatories, { label: "Prepared by:", name: "", position: "" }]);
  };

  const handleUpdateSignatory = (index: number, field: string, value: string) => {
    const updated = [...signatories];
    updated[index] = { ...updated[index], [field]: value };
    setSignatories(updated);
  };

  const handleRemoveSignatory = (index: number) => {
    setSignatories(signatories.filter((_: any, i: number) => i !== index));
  };

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
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: 8.5in 13in; margin: 0.5in; }
          aside, nav, header, footer, .sidebar, .d-print-none { display: none !important; }
          html, body, main, #__next, .layout-wrapper {
            margin: 0 !important; padding: 0 !important; width: 100% !important; max-width: 100% !important; background-color: white !important;
          }
          .print-container {
            position: static !important; width: 100% !important;
            margin: 0 !important; padding: 0 !important; border: none !important; box-shadow: none !important; background-color: white !important;
          }
          .print-container * { color: #000000 !important; background-color: transparent !important; }
          .print-container table { border-collapse: collapse !important; margin-bottom: 15px !important; width: 100% !important; border: 1.5px solid #000000 !important; }
          .print-container th, .print-container td { border: 1px solid #000000 !important; padding: 5px 8px !important; }
          .print-container .bg-dark { background-color: #f8f9fa !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .print-border { border: 1.5px solid #000000 !important; }
          h6 { margin-top: 15px !important; margin-bottom: 5px !important; }
          .signature-block { margin-top: 40px !important; page-break-inside: avoid !important; }
        }
      `}} />

      <div className="card p-3 p-md-4 border-secondary shadow-sm bg-body text-body print-container">
        
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4 d-print-none">
          <div>
            <h5 className="text-info m-0 fw-bold">COLLECTIONS & EXPENSES SUMMARY ({term})</h5>
            <small className="text-muted">Official financial statement matching legacy ledger output.</small>
          </div>
          <div>
            <button className="btn btn-outline-info btn-sm fw-bold me-2" onClick={() => setShowSettings(true)}>
              <i className="bi bi-gear-fill me-1"></i>Report Settings
            </button>
            <button className="btn btn-outline-secondary btn-sm fw-bold" onClick={() => window.print()}>
              <i className="bi bi-printer me-1"></i>Print Summary Report
            </button>
          </div>
        </div>

        <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-dark border-opacity-50">
          <div style={{ width: '90px', flexShrink: 0 }} className="text-center">
            <img src={getAssetUrl('fcu.png')} alt="FCU Logo" style={{ width: '100%', maxHeight: '90px', objectFit: 'contain' }} />
          </div>
          <div className="text-center flex-grow-1 px-3">
            <div className="fw-bold text-uppercase" style={{ fontSize: '1.1rem' }}>Filamer Christian University</div>
            <div className="fw-bold text-uppercase text-info" style={{ fontSize: '0.9rem', letterSpacing: '0.5px' }}>{orgName}</div>
            <div className="text-muted small">Roxas Avenue, Roxas City, Capiz, Philippines 5800</div>
            <div className="mt-3 fw-bold text-uppercase" style={{ fontSize: '0.95rem' }}>FINANCIAL REPORT OF CONTRIBUTIONS AND EXPENSES</div>
            <div className="text-muted small fst-italic mt-1">{ay} &nbsp;|&nbsp; {term}</div>
          </div>
          <div style={{ width: '90px', flexShrink: 0 }} className="text-center">
            <img 
              src={displayLogo} 
              alt={`${orgName} Logo`} 
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getAssetUrl('engineering_logo.png'); }} 
              style={{ width: '100%', maxHeight: '90px', objectFit: 'contain' }} 
            />
          </div>
        </div>

        <h6 className="text-info text-uppercase fw-bold mt-2">Collections ({term})</h6>
        <div className="table-responsive mb-4">
          <table className="table table-sm table-bordered border-dark align-middle text-body mb-0" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr className="text-muted">
                <th>Collection Item</th>
                <th className="text-end" style={{ width: '15%' }}>Rate</th>
                <th className="text-end" style={{ width: '15%' }}># Students</th>
                <th className="text-end" style={{ width: '20%' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={4} className="fw-bold text-info py-2">Departmental Fee</td></tr>
              {termPkg?.items?.map((item: any, idx: number) => {
                const entry = collectionHierarchy[item.name] || { count: 0, total: 0 };
                return (
                  <tr key={idx}>
                    <td className="ps-3">{item.name}</td>
                    <td className="text-end">{fmt(item.rate as any)}</td>
                    <td className="text-end">{entry.count}</td>
                    <td className="text-end">{fmt(entry.total as any)}</td>
                  </tr>
                );
              })}

              <tr><td colSpan={4} className="fw-bold text-info py-2 pt-3">Other Fees / Merchandise / Penalties</td></tr>
              {Object.keys(collectionHierarchy).map((k: string, idx: number) => {
                if (!termPkg?.items?.some((pi: any) => pi.name === k) && k !== "General Fund (Carried Over)" && k !== "New Accounts Inflow") {
                  return (
                    <tr key={idx}>
                      <td className="ps-3">{k}</td>
                      <td className="text-end">-</td>
                      <td className="text-end">{collectionHierarchy[k].count}</td>
                      <td className="text-end">{fmt(collectionHierarchy[k].total as any)}</td>
                    </tr>
                  );
                }
                return null;
              })}

              <tr>
                <td className="ps-3 fw-semibold">General Fund (Carried Over)</td>
                <td className="text-end">-</td>
                <td className="text-end">{(collectionHierarchy["General Fund (Carried Over)"] || {}).count || 0}</td>
                <td className="text-end">{fmt((collectionHierarchy["General Fund (Carried Over)"] || {}).total as any || 0)}</td>
              </tr>
              <tr>
                <td className="ps-3 fw-semibold">New Accounts (Current Term Inflow)</td>
                <td className="text-end">-</td>
                <td className="text-end">{(collectionHierarchy["New Accounts Inflow"] || {}).count || 0}</td>
                <td className="text-end">{fmt((collectionHierarchy["New Accounts Inflow"] || {}).total as any || 0)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="fw-bold bg-dark text-white">
                <td colSpan={3} className="text-end py-1">SUB TOTAL:</td>
                <td className="text-end text-info">{fmt(grandCollectionTotal as any)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <h6 className="text-danger text-uppercase fw-bold mt-3">Expenses ({term})</h6>
        <div className="table-responsive mb-4">
          <table className="table table-sm table-bordered border-dark align-middle text-body mb-0" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr className="text-muted">
                <th>Fund Source Account</th>
                <th style={{ width: '15%' }}></th>
                <th style={{ width: '15%' }}></th>
                <th className="text-end" style={{ width: '20%' }}>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(expensesByFund).length === 0 ? (
                <tr><td colSpan={4} className="text-center text-muted py-2">No liquidated expenses recorded for this term.</td></tr>
              ) : (
                Object.entries(expensesByFund).sort().map(([fundName, totalAmt]: any, idx: number) => (
                  <tr key={idx}>
                    <td className="ps-3 fw-bold">{fundName}</td>
                    <td></td>
                    <td></td>
                    <td className="text-end text-danger">{fmt(totalAmt as any)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="fw-bold bg-dark text-white">
                <td colSpan={3} className="text-end py-1">SUB TOTAL:</td>
                <td className="text-end text-danger">{fmt(grandExpenseTotal as any)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <h6 className="text-warning text-uppercase fw-bold mt-3">Collectibles & Receivables ({term})</h6>
        <div className="text-muted small fst-italic mb-1" style={{ fontSize: '0.75rem' }}>NOTE: These are amounts to be collected from students who have not paid.</div>
        <div className="table-responsive mb-4">
          <table className="table table-sm table-bordered border-dark align-middle text-body mb-0" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr className="text-muted">
                <th>Category / Description</th>
                <th style={{ width: '15%' }}></th>
                <th className="text-end" style={{ width: '15%' }}>Qty / Headcount</th>
                <th className="text-end" style={{ width: '20%' }}>Total Due</th>
              </tr>
            </thead>
            <tbody>
              {collectibles.length === 0 ? (
                <tr><td colSpan={4} className="text-center text-muted py-2">No collectibles recorded for this term.</td></tr>
              ) : (
                collectibles.map((col: any, idx: number) => (
                  <tr key={idx}>
                    <td className="ps-3">{col.category}</td>
                    <td></td>
                    <td className="text-end">{col.headcount}</td>
                    <td className="text-end fw-bold">{fmt(col.total as any)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="fw-bold bg-dark text-white">
                <td colSpan={3} className="text-end py-1">SUB TOTAL:</td>
                <td className="text-end text-warning">{fmt(totalCollectiblesSum as any)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="card p-2 d-flex flex-row justify-content-between align-items-center flex-wrap gap-2 mb-4 bg-body-secondary border-dark print-border rounded-0">
          <div>
            <span className="fw-bold text-uppercase text-body">NET TREASURY BALANCE (NET ENDING POSITION):</span>
            <div className="text-muted small" style={{ fontSize: '0.75rem' }}>Total Dynamic Balance (including initial funds, rollovers & advances)</div>
          </div>
          <div className={`fs-5 fw-bold ${netBalance >= 0 ? 'text-success' : 'text-danger'}`}>
            {fmt(netBalance as any)}
          </div>
        </div>

        <div className="card p-3 mb-4 bg-transparent border-dark text-body rounded-0 print-border">
          <h6 className="fw-bold text-uppercase mb-3"><i className="bi bi-safe2 me-2"></i>Fund Location / Safekeeping Status</h6>
          <div className="d-flex justify-content-between small mb-1">
            <span>Total Physically Deposited to Univ. Cashier:</span>
            <span className="fw-semibold text-success">{fmt(totalDeposited || 0)}</span>
          </div>
          <div className="d-flex justify-content-between small mb-1">
            <span>Total Physically Withdrawn:</span>
            <span className="fw-semibold text-danger">({fmt(totalWithdrawn || 0)})</span>
          </div>
          <hr className="border-dark my-2 opacity-25" />
          <div className="d-flex justify-content-between fw-bold">
            <span>CURRENT BALANCE IN SAFEKEEPING:</span>
            <span className="text-info">{fmt(safeBalance)}</span>
          </div>
          <div className="d-flex justify-content-between fw-bold mt-2 pt-2 border-top border-dark text-dark">
            <span>PHYSICAL CASH ON HAND <span className="fw-normal">(Net Balance minus Safekeeping)</span>:</span>
            <span>{fmt(netBalance - safeBalance)}</span>
          </div>
        </div>

        <div className="row mt-5 pt-3 text-body signature-block" style={{ fontSize: '0.85rem' }}>
          {signatories && signatories.length > 0 ? (
            signatories.map((sig: any, idx: number) => (
              <div className="col text-center" key={idx}>
                <div className="fw-bold text-uppercase text-muted mb-1" style={{ fontSize: '0.75rem' }}>{sig.label}</div>
                <div style={{ height: '40px' }}></div>
                <div className="fw-bold border-top border-dark pt-1 d-inline-block px-3">{sig.name || "________________"}</div>
                <div className="text-muted mt-1" style={{ fontSize: '0.7rem' }}>{sig.position || "Position"}</div>
              </div>
            ))
          ) : (
            <div className="text-center text-muted small w-100">
              <em>No signatories configured. Click "Report Settings" to add them.</em>
            </div>
          )}
        </div>

        <div className="mt-5 pt-3 small fw-bold text-end text-muted" style={{ fontSize: '0.75rem' }}>
          cc: VPAA, VPF, OSA
        </div>
      </div>
      
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
                  Customize the official signatories for this department. These will appear at the bottom of the Summary and Liquidation reports.
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
    </>
  );
}