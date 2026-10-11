// /(protected)/liquidations/LiquidationHistory.tsx

"use client";

import React, { useState, useEffect } from "react";
import { fmt } from "@/lib/utils";

export default function LiquidationHistory({ 
  audits, 
  orgName, 
  logoUrl, 
  signatories, 
  ay, 
  term 
}: any) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [printData, setPrintData] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const getAssetUrl = (filename: string) => {
    if (mounted && window.location.hostname.endsWith('.localhost')) {
      return `http://localhost:${window.location.port}/${filename}`;
    }
    return `/${filename}`;
  };

  const displayLogo = logoUrl || getAssetUrl('engineering_logo.png');

  // =================================================================
  // EXPORT CSV LOGIC
  // =================================================================
  const handleExportCSV = (audit: any) => {
    const headers = ["Quantity", "OR/SI Number", "Description", "Subtotal (PHP)"];
    
    const rows = audit.items.map((item: any) => [
      item.qty,
      `"${item.orSiNumber || 'N/A'}"`, 
      `"${item.description.replace(/"/g, '""')}"`, 
      item.subTotal.toFixed(2)
    ]);

    const csvContent = [headers.join(","), ...rows.map((r: any[]) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement("a");
    link.href = url;
    link.download = `Liquidation_${audit.auditId}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
                  <td className="fw-bold text-info">{audit.auditId}</td>
                  <td>{new Date(audit.date).toLocaleDateString()}</td>
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
                    <button className="btn btn-sm btn-outline-primary" onClick={() => handlePrint(audit)} title="Print Audited Report">
                      <i className="bi bi-printer-fill"></i> Print
                    </button>
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
          
          {/* INSTITUTIONAL HEADER */}
          <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-dark">
            <div style={{ width: '90px' }} className="text-center">
              <img src={getAssetUrl('fcu.png')} alt="FCU Logo" style={{ width: '100%', maxHeight: '90px', objectFit: 'contain' }} />
            </div>
            <div className="text-center flex-grow-1 px-3">
              <div className="fw-bold text-uppercase" style={{ fontSize: '1.1rem' }}>Filamer Christian University</div>
              <div className="fw-bold text-uppercase" style={{ fontSize: '0.9rem' }}>{orgName}</div>
              <div className="small">Roxas Avenue, Roxas City, Capiz</div>
              <div className="mt-3 fw-bold text-uppercase" style={{ fontSize: '0.95rem' }}>OFFICIAL AUDITED LIQUIDATION REPORT</div>
              <div className="small mt-1">{ay} &nbsp;|&nbsp; {term}</div>
            </div>
            <div style={{ width: '90px' }} className="text-center">
              <img 
                src={displayLogo} 
                alt="Org Logo" 
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = getAssetUrl('engineering_logo.png'); }} 
                style={{ width: '100%', maxHeight: '90px', objectFit: 'contain' }} 
              />
            </div>
          </div>

          {/* AUDIT METADATA */}
          <div className="row mb-3 mt-4 small">
            <div className="col-6">
              <div className="mb-1"><strong>Audit ID:</strong> <span className="font-monospace">{printData.auditId}</span></div>
              <div className="mb-1"><strong>Date Liquidated:</strong> {new Date(printData.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
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
            {signatories && signatories.length > 0 ? (
              signatories.map((sig: any, idx: number) => (
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
    </>
  );
}