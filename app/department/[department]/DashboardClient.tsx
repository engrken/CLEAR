// /app/department/[department]/DashboardClient.tsx
"use client";
import { useState } from "react";
import Link from "next/link";
import { fmt } from "@/lib/utils";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

export default function DashboardClient({
  overview,
  organization,
  ay,
  term,
  basePath,
  queryString
}: {
  overview: any;
  organization: any;
  ay: string;
  term: string;
  basePath: string;
  queryString: string;
}) {
  const [subtab, setSubtab] = useState<"funds" | "advances">("funds");

  // --- SAFE-KEEPING CALCULATIONS ---
  const cashierBalance = overview.cashierBalance || 0;
  const totalDeposited = overview.totalDeposited || 0;
  const totalWithdrawn = overview.totalWithdrawn || 0;
  const physicalCashOnHand = (overview.remainingBalance || 0) - cashierBalance;

  // --- CHART 1: Fund Allocation Health (Doughnut) ---
  const activeFunds = overview.fundsList.filter((f: any) => f.balance > 0);
  const fundPieData = {
    labels: activeFunds.map((f: any) => f.name),
    datasets: [{
      data: activeFunds.map((f: any) => f.balance),
      backgroundColor: ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f87171', '#c084fc'],
      borderWidth: 1,
      borderColor: 'var(--bs-body-bg)' // Adapts to theme
    }]
  };

  // --- CHART 2: Cash Flow Velocity (Bar) ---
  const flowBarData = {
    labels: ['Total Collected', 'Audited Expenses', 'Active Advances (Unliquidated)'],
    datasets: [{
      label: 'Amount (₱)',
      data: [overview.grandCollectionTotal, overview.grandExpenseTotal, overview.totalUnliquidated],
      backgroundColor: ['#22c55e', '#ef4444', '#f59e0b'],
      borderRadius: 6,
    }]
  };

  const chartOptionsBase = {
    responsive: true,
    maintainAspectRatio: false,
    color: '#6c757d',
    plugins: { legend: { position: 'bottom' as const, labels: { color: '#6c757d' } } }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        .stat-card {
          background-color: var(--bs-tertiary-bg); 
          border: 1px solid var(--bs-border-color); 
          border-radius: 1rem;
          padding: 1.25rem; transition: all 0.3s ease; height: 100%; display: flex; flex-direction: column;
        }
        .stat-card:hover { transform: translateY(-5px); border-color: #38bdf8; box-shadow: 0 10px 20px rgba(0,0,0,0.15); }
        .stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-bottom: 1rem; }
        .quick-action-btn { background-color: var(--bs-body-bg); border: 1px solid var(--bs-border-color); border-radius: 0.75rem; color: var(--bs-body-color); transition: all 0.2s ease; }
        .quick-action-btn:hover { background-color: var(--bs-tertiary-bg); border-color: #38bdf8; color: #38bdf8; }
      `}} />
      
      <div className="d-flex flex-column gap-4">
        {/* HEADER */}
        <div>
          <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-2 py-1 mb-2 shadow-sm text-uppercase">
            <i className={`me-1 ${organization.type === 'Organization' ? 'bi bi-people-fill' : 'bi bi-building'}`}></i>
            {organization.type || 'Department'} Workspace
          </span>
          <h4 className="fw-bold mb-1 text-body">{organization.name}</h4>
          <p className="text-secondary small mb-0">Financial Analytics & Active Insights for {ay} | {term}</p>
        </div>

        {/* QUICK ACTIONS */}
        <div className="row g-2">
          <div className="col-6 col-md-3">
            <Link href={`${basePath}/collections${queryString}`} className="quick-action-btn w-100 text-decoration-none d-flex align-items-center p-2 gap-2 shadow-sm">
              <div className="bg-info bg-opacity-10 text-info rounded p-1"><i className="bi bi-cash-stack fs-5"></i></div>
              <span className="small fw-semibold">Log Collection</span>
            </Link>
          </div>
          <div className="col-6 col-md-3">
            <Link href={`${basePath}/cashier-remittance${queryString}`} className="quick-action-btn w-100 text-decoration-none d-flex align-items-center p-2 gap-2 shadow-sm">
              <div className="bg-success bg-opacity-10 text-success rounded p-1"><i className="bi bi-safe2 fs-5"></i></div>
              <span className="small fw-semibold">Univ. Cashier</span>
            </Link>
          </div>
          <div className="col-6 col-md-3">
            <Link href={`${basePath}/advances${queryString}`} className="quick-action-btn w-100 text-decoration-none d-flex align-items-center p-2 gap-2 shadow-sm">
              <div className="bg-warning bg-opacity-10 text-warning rounded p-1"><i className="bi bi-journal-arrow-up fs-5"></i></div>
              <span className="small fw-semibold">Issue Advance</span>
            </Link>
          </div>
          <div className="col-6 col-md-3">
            <Link href={`${basePath}/reports${queryString}`} className="quick-action-btn w-100 text-decoration-none d-flex align-items-center p-2 gap-2 shadow-sm">
              <div className="bg-secondary bg-opacity-25 text-body rounded p-1"><i className="bi bi-bar-chart-fill fs-5"></i></div>
              <span className="small fw-semibold">Full Reports</span>
            </Link>
          </div>
        </div>

        {/* KPI CARDS */}
        <div className="row g-3">
          <div className="col-6 col-lg-3">
            <div className="stat-card">
              <div className="stat-icon bg-info bg-opacity-10 text-info"><i className="bi bi-wallet2"></i></div>
              <small className="text-secondary text-uppercase fw-bold mb-1" style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}>Total Collections</small>
              <div className="fs-4 fw-bold mt-auto text-body">{fmt(overview.grandCollectionTotal)}</div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="stat-card">
              <div className="stat-icon bg-warning bg-opacity-10 text-warning"><i className="bi bi-journal-arrow-up"></i></div>
              <small className="text-secondary text-uppercase fw-bold mb-1" style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}>Active Unliquidated</small>
              <div className="fs-4 fw-bold text-warning mt-auto">{fmt(overview.totalUnliquidated)}</div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="stat-card">
              <div className="stat-icon bg-danger bg-opacity-10 text-danger"><i className="bi bi-receipt"></i></div>
              <small className="text-secondary text-uppercase fw-bold mb-1" style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}>Audited Expenses</small>
              <div className="fs-4 fw-bold mt-auto text-body">{fmt(overview.grandExpenseTotal)}</div>
            </div>
          </div>
          <div className="col-6 col-lg-3">
            <div className="stat-card position-relative overflow-hidden border-info">
              <div className="position-absolute top-0 end-0 p-3 opacity-25">
                <i className="bi bi-piggy-bank" style={{ fontSize: '4rem', color: overview.remainingBalance >= 0 ? '#22c55e' : '#ef4444' }}></i>
              </div>
              <div className={`stat-icon bg-opacity-10 ${overview.remainingBalance >= 0 ? 'bg-success text-success' : 'bg-danger text-danger'}`}><i className="bi bi-bank"></i></div>
              <small className="text-secondary text-uppercase fw-bold mb-1" style={{ fontSize: "0.7rem", letterSpacing: "0.5px", zIndex: 1 }}>Net Treasury Balance</small>
              <div className={`fs-4 fw-bold mt-auto ${overview.remainingBalance >= 0 ? "text-success" : "text-danger"}`} style={{ zIndex: 1 }}>{fmt(overview.remainingBalance)}</div>
            </div>
          </div>
        </div>

        {/* 🚀 NEW: FUND LOCATION TRACKER (Safekeeping vs Cash on Hand) */}
        <div className="row g-3 mt-1">
          <div className="col-12 col-md-6">
            <div className="card h-100 border-info shadow-sm bg-info bg-opacity-10 transition-all">
              <div className="card-body p-3 p-md-4 d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-info fw-bold mb-1 text-uppercase"><i className="bi bi-safe2-fill me-2"></i>University Cashier</h6>
                  <small className="text-muted fw-semibold">Funds currently in safekeeping</small>
                  <div className="d-flex gap-3 mt-2 small fw-bold">
                    <span className="text-success"><i className="bi bi-arrow-up-right me-1"></i>{fmt(totalDeposited)} In</span>
                    <span className="text-danger"><i className="bi bi-arrow-down-right me-1"></i>{fmt(totalWithdrawn)} Out</span>
                  </div>
                </div>
                <div className="text-end">
                  <h3 className="fw-bold text-info mb-0">{fmt(cashierBalance)}</h3>
                </div>
              </div>
            </div>
          </div>
          
          <div className="col-12 col-md-6">
            <div className="card h-100 border-secondary shadow-sm bg-body transition-all">
              <div className="card-body p-3 p-md-4 d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-body fw-bold mb-1 text-uppercase"><i className="bi bi-cash me-2 text-success"></i>Physical Cash on Hand</h6>
                  <small className="text-muted fw-semibold">Held by student treasurer</small>
                  <div className="mt-2 small text-muted">
                    Net Balance minus Safekeeping
                  </div>
                </div>
                <div className="text-end">
                  <h3 className={`fw-bold mb-0 ${physicalCashOnHand < 0 ? 'text-danger' : 'text-success'}`}>{fmt(physicalCashOnHand)}</h3>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ANALYTICS CHARTS ROW */}
        <div className="row g-3">
          <div className="col-12 col-lg-5">
            <div className="card p-3 border-secondary shadow-sm bg-card h-100">
              <h6 className="fw-bold text-body mb-3">Available Target Funds</h6>
              <div style={{ position: 'relative', height: '260px' }}>
                {activeFunds.length > 0 ? (
                  <Doughnut data={fundPieData} options={chartOptionsBase} />
                ) : (
                  <div className="d-flex h-100 align-items-center justify-content-center text-secondary small">No positive fund balances to display.</div>
                )}
              </div>
            </div>
          </div>
          <div className="col-12 col-lg-7">
            <div className="card p-3 border-secondary shadow-sm bg-card h-100">
              <h6 className="fw-bold text-body mb-3">Cash Flow Velocity</h6>
              <div style={{ position: 'relative', height: '260px' }}>
                <Bar 
                  data={flowBarData} 
                  options={{
                    ...chartOptionsBase, 
                    plugins: { legend: { display: false } },
                    scales: { 
                      y: { grid: { color: 'rgba(108, 117, 125, 0.2)' }, ticks: { color: '#6c757d' } }, 
                      x: { grid: { display: false }, ticks: { color: '#6c757d' } } 
                    }
                  }} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* WIDGET PANEL (Tables) */}
        <div className="card p-3 p-md-4 border-secondary shadow-sm bg-card mt-2">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
            <h6 className="fw-bold text-body m-0">
              {subtab === "funds" ? <><i className="bi bi-list-columns me-2 text-info"></i> Detailed Ledger</> : <><i className="bi bi-clock-history me-2 text-warning"></i> Pending Advances</>}
            </h6>
            <div className="btn-group btn-group-sm rounded shadow-sm">
              <button onClick={() => setSubtab("funds")} className={`btn ${subtab === "funds" ? "btn-info text-dark fw-bold" : "btn-outline-secondary"}`}>Fund Balances</button>
              <button onClick={() => setSubtab("advances")} className={`btn ${subtab === "advances" ? "btn-info text-dark fw-bold" : "btn-outline-secondary"}`}>Pending Advances</button>
            </div>
          </div>
          
          {subtab === "funds" ? (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 text-body" style={{ fontSize: '0.9rem' }}>
                <thead>
                  <tr className="text-secondary small border-bottom border-secondary">
                    <th className="py-2">Account Pool</th>
                    <th className="text-end py-2">Allocated</th>
                    <th className="text-end py-2">Disbursed</th>
                    <th className="text-end py-2">Liquidated</th>
                    <th className="text-end py-2">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.fundsList.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-4 text-secondary">No fund activity recorded.</td></tr>
                  ) : (
                    overview.fundsList.map((f: any) => (
                      <tr key={f.name} className="border-bottom border-secondary">
                        <td className="py-2"><strong>{f.name}</strong></td>
                        <td className="text-end text-info py-2">{fmt(f.collected)}</td>
                        <td className="text-end text-warning py-2">{fmt(f.unliquidated)}</td>
                        <td className="text-end text-danger py-2">{fmt(f.spent)}</td>
                        <td className={`text-end fw-bold py-2 ${f.balance < 0 ? "text-danger" : "text-success"}`}>{fmt(f.balance)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 text-body" style={{ fontSize: '0.9rem' }}>
                <thead>
                  <tr className="text-secondary small border-bottom border-secondary">
                    <th className="py-2">Advance ID</th>
                    <th className="py-2">Requestor</th>
                    <th className="text-end py-2">Amount</th>
                    <th className="py-2">Status</th>
                    <th className="text-center py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.unliquidatedAdvances.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-4 text-secondary">No pending advances.</td></tr>
                  ) : (
                    overview.unliquidatedAdvances.map((ca: any) => (
                      <tr key={ca.id} className="border-bottom border-secondary">
                        <td className="font-monospace text-secondary py-2">{ca.id}</td>
                        <td className="py-2"><strong className="text-accent">{ca.requestor}</strong></td>
                        <td className="text-end text-warning fw-bold py-2">{fmt(ca.amount)}</td>
                        <td className="py-2"><span className="badge bg-warning text-dark">{ca.status}</span></td>
                        <td className="text-center py-2">
                          <Link href={`${basePath}/liquidations?caId=${encodeURIComponent(ca.id)}&ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}`} className="btn btn-outline-info btn-sm py-0 fw-bold">
                            Liquidate
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}