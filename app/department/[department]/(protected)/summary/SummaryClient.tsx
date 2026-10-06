"use client";

import { useState, useEffect } from "react";
import { fmt } from "@/lib/utils";

interface CollectionItem {
  count: number;
  total: number;
}

interface CollectibleItem {
  category: string;
  headcount: number;
  total: number;
}

export default function SummaryClient({
  department,
  ay,
  term,
  termPkg,
  otherRates,
  collectionHierarchy,
  grandCollectionTotal,
  expensesByFund,
  grandExpenseTotal,
  collectibles,
  totalCollectiblesSum
}: {
  department: string;
  ay: string;
  term: string;
  termPkg: { total: number; items: { name: string; rate: number; fund: string }[] };
  otherRates: Record<string, number>;
  collectionHierarchy: Record<string, CollectionItem>;
  grandCollectionTotal: number;
  expensesByFund: Record<string, number>;
  grandExpenseTotal: number;
  collectibles: CollectibleItem[];
  totalCollectiblesSum: number;
}) {
  const netBalance = grandCollectionTotal - grandExpenseTotal;

  // Hydration-safe asset path resolver
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const getAssetUrl = (filename: string) => {
    if (mounted && window.location.hostname.endsWith('.localhost')) {
      return `http://localhost:${window.location.port}/${filename}`;
    }
    return `/${filename}`;
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: 8.5in 13in;
            margin: 0.5in; 
          }
          
          /* Hide UI clutter */
          aside, nav, header, .sidebar, .d-print-none {
            display: none !important;
          }
          
          /* Reset layout margins */
          html, body, main, #__next, .layout-wrapper {
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background-color: white !important;
          }

          /* Detach print container from Next.js centering wrappers */
          .print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background-color: white !important;
          }

          /* Strip colors */
          .print-container * {
            color: #000000 !important;
            background-color: transparent !important;
          }
          
          /* FORCE STRICT BORDERS TO PREVENT BROWSER INK-SAVING REMOVAL */
          .print-container table { 
            border-collapse: collapse !important; 
            margin-bottom: 15px !important; 
            width: 100% !important; 
            border: 1.5px solid #000000 !important; 
          }
          .print-container th, 
          .print-container td {
            border: 1px solid #000000 !important;
            padding: 5px 8px !important; 
          }

          /* Retain dark background for subtotals */
          .print-container .bg-dark {
            background-color: #f8f9fa !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          h6 { margin-top: 15px !important; margin-bottom: 5px !important; }
          
          /* Keep signatures together */
          .signature-block { 
            margin-top: 40px !important; 
            page-break-inside: avoid !important; 
          }
        }
      `}} />

      <div className="card p-3 p-md-4 border-secondary shadow-sm bg-card text-color print-container">
        {/* HEADER TOOLBAR (Hidden during print) */}
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4 d-print-none">
          <div>
            <h5 className="text-accent m-0 fw-bold">COLLECTIONS & EXPENSES SUMMARY ({term})</h5>
            <small className="text-muted">Official departmental financial statement matching legacy ledger output.</small>
          </div>
          <button className="btn btn-outline-secondary btn-sm fw-bold" onClick={() => window.print()}>
            <i className="bi bi-printer me-1"></i>Print Summary Report
          </button>
        </div>

        {/* ISO / INSTITUTIONAL PRINT HEADER */}
        <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-dark border-opacity-50">
          
          {/* LEFT LOGO (FCU) */}
          <div style={{ width: '90px', flexShrink: 0 }} className="text-center">
            <img 
              src={getAssetUrl('fcu.png')} 
              alt="FCU Logo" 
              style={{ width: '100%', maxHeight: '90px', objectFit: 'contain' }} 
            />
          </div>
          
          {/* CENTER TEXT */}
          <div className="text-center flex-grow-1 px-3">
            <div className="fw-bold text-uppercase" style={{ fontSize: '0.9rem', letterSpacing: '0.5px' }}>
              Filamer Christian University
            </div>
            <div className="fw-bold text-uppercase text-accent" style={{ fontSize: '1.1rem' }}>
              College of {decodeURIComponent(department)}
            </div>
            <div className="text-muted small">
              Roxas Avenue, Roxas City, Capiz, Philippines 5800
            </div>
            <div className="mt-3 fw-bold text-uppercase" style={{ fontSize: '0.95rem' }}>
              Departmental Financial Audit & Liquidation Summary Report
            </div>
            <div className="text-muted small fst-italic mt-1">
              {ay} &nbsp;|&nbsp; {term}
            </div>
          </div>

          {/* RIGHT LOGO (Department) */}
          <div style={{ width: '90px', flexShrink: 0 }} className="text-center">
            <img 
              src={getAssetUrl(`${decodeURIComponent(department).toLowerCase().replace(/\s+/g, '')}_logo.png`)} 
              alt="Department Logo" 
              onError={(e) => { 
                e.currentTarget.onerror = null; 
                e.currentTarget.src = getAssetUrl('engineering_logo.png');
              }} 
              style={{ width: '100%', maxHeight: '90px', objectFit: 'contain' }} 
            />
          </div>

        </div>

        {/* COLLECTIONS SECTION */}
        <h6 className="text-info text-uppercase fw-bold mt-2">Collections ({term})</h6>
        <div className="table-responsive mb-4">
          <table className="table table-sm table-bordered border-dark align-middle text-color mb-0" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr className="text-muted">
                <th>Collection Item</th>
                <th className="text-end" style={{ width: '15%' }}>Rate</th>
                <th className="text-end" style={{ width: '15%' }}># Students</th>
                <th className="text-end" style={{ width: '20%' }}>TOTAL</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={4} className="fw-bold text-accent py-2">Departmental Fee</td></tr>
              {termPkg.items.map((item, idx) => {
                const entry = collectionHierarchy[item.name] || { count: 0, total: 0 };
                return (
                  <tr key={idx}>
                    <td className="ps-3">{item.name}</td>
                    <td className="text-end">{fmt(item.rate)}</td>
                    <td className="text-end">{entry.count}</td>
                    <td className="text-end">{fmt(entry.total)}</td>
                  </tr>
                );
              })}

              <tr><td colSpan={4} className="fw-bold text-accent py-2 pt-3">Other Fees / Merchandise</td></tr>
              {Object.keys(collectionHierarchy).map((k, idx) => {
                if (!termPkg.items.some(pi => pi.name === k) && k !== "General Fund (Carried Over)" && k !== "New Accounts Inflow") {
                  const rateVal = otherRates[k] !== undefined ? fmt(otherRates[k]) : "-";
                  return (
                    <tr key={idx}>
                      <td className="ps-3">{k}</td>
                      <td className="text-end">{rateVal}</td>
                      <td className="text-end">{collectionHierarchy[k].count}</td>
                      <td className="text-end">{fmt(collectionHierarchy[k].total)}</td>
                    </tr>
                  );
                }
                return null;
              })}

              <tr>
                <td className="ps-3 fw-semibold">General Fund (Carried Over)</td>
                <td className="text-end">-</td>
                <td className="text-end">{(collectionHierarchy["General Fund (Carried Over)"] || {}).count || 0}</td>
                <td className="text-end">{fmt((collectionHierarchy["General Fund (Carried Over)"] || {}).total || 0)}</td>
              </tr>
              <tr>
                <td className="ps-3 fw-semibold">New Accounts (Current Term Inflow)</td>
                <td className="text-end">-</td>
                <td className="text-end">{(collectionHierarchy["New Accounts Inflow"] || {}).count || 0}</td>
                <td className="text-end">{fmt((collectionHierarchy["New Accounts Inflow"] || {}).total || 0)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="fw-bold bg-dark text-white">
                <td colSpan={3} className="text-end py-1">SUB TOTAL:</td>
                <td className="text-end text-accent">{fmt(grandCollectionTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* EXPENSES SECTION */}
        <h6 className="text-danger text-uppercase fw-bold mt-3">Expenses ({term})</h6>
        <div className="table-responsive mb-4">
          <table className="table table-sm table-bordered border-dark align-middle text-color mb-0" style={{ fontSize: '0.85rem' }}>
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
                Object.entries(expensesByFund).sort().map(([fundName, totalAmt], idx) => (
                  <tr key={idx}>
                    <td className="ps-3 fw-bold">{fundName}</td>
                    <td></td>
                    <td></td>
                    <td className="text-end text-danger">{fmt(totalAmt)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="fw-bold bg-dark text-white">
                <td colSpan={3} className="text-end py-1">SUB TOTAL:</td>
                <td className="text-end text-danger">{fmt(grandExpenseTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* COLLECTIBLES & RECEIVABLES SECTION */}
        <h6 className="text-warning text-uppercase fw-bold mt-3">Collectibles & Receivables ({term})</h6>
        <div className="text-muted small fst-italic mb-1" style={{ fontSize: '0.75rem' }}>NOTE: These are amounts to be collected from students who have not paid.</div>
        <div className="table-responsive mb-4">
          <table className="table table-sm table-bordered border-dark align-middle text-color mb-0" style={{ fontSize: '0.85rem' }}>
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
                collectibles.map((col, idx) => (
                  <tr key={idx}>
                    <td className="ps-3">{col.category}</td>
                    <td></td>
                    <td className="text-end">{col.headcount}</td>
                    <td className="text-end fw-bold">{fmt(col.total)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="fw-bold bg-dark text-white">
                <td colSpan={3} className="text-end py-1">SUB TOTAL:</td>
                <td className="text-end text-warning">{fmt(totalCollectiblesSum)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* REMAINING BALANCE (NET ENDING POSITION) */}
        <div className="card p-2 border-dark bg-dark text-white d-flex flex-row justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <div>
            <span className="fw-bold text-uppercase">REMAINING BALANCE (NET ENDING POSITION):</span>
            <div className="text-muted small" style={{ fontSize: '0.75rem' }}>Total Collections minus Total Liquidated Expenses</div>
          </div>
          <div className={`fs-5 fw-bold ${netBalance >= 0 ? 'text-success' : 'text-danger'}`}>
            {fmt(netBalance)}
          </div>
        </div>

        {/* ISO SIGNATURE BLOCK */}
        <div className="row mt-4 pt-3 text-color signature-block" style={{ fontSize: '0.85rem' }}>
          <div className="col-3 text-center">
            <div className="fw-bold text-uppercase text-muted mb-1" style={{ fontSize: '0.75rem' }}>Prepared by:</div>
            <div style={{ height: '40px' }}></div>
            <div className="fw-bold border-top border-dark pt-1 d-inline-block px-3">Auditor</div>
          </div>
          <div className="col-3 text-center">
            <div className="fw-bold text-uppercase text-muted mb-1" style={{ fontSize: '0.75rem' }}>Attested by:</div>
            <div style={{ height: '40px' }}></div>
            <div className="fw-bold border-top border-dark pt-1 d-inline-block px-3">Treasurer</div>
          </div>
          <div className="col-3 text-center">
            <div className="fw-bold text-uppercase text-muted mb-1" style={{ fontSize: '0.75rem' }}>Noted:</div>
            <div style={{ height: '40px' }}></div>
            <div className="fw-bold border-top border-dark pt-1 d-inline-block px-3">Adviser</div>
          </div>
          <div className="col-3 text-center">
            <div className="fw-bold text-uppercase text-muted mb-1" style={{ fontSize: '0.75rem' }}>Approved:</div>
            <div style={{ height: '40px' }}></div>
            <div className="fw-bold border-top border-dark pt-1 d-inline-block px-3">Dean</div>
          </div>
        </div>

        {/* CC FOOTER */}
        <div className="mt-5 pt-3 small fw-bold text-end text-muted" style={{ fontSize: '0.75rem' }}>
          cc: VPAA, VPF, OSA
        </div>
      </div>
    </>
  );
}