// app/department/[department]/page.tsx

import { prisma } from "@/lib/prisma";
import { getDepartmentFinancials } from "./actions";
import { fmt } from "@/lib/utils";
import Link from "next/link";
import { auth } from "@/auth";
import OtpModal from "./components/OtpModal";
import { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function EntityOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{
    ay?: string;
    term?: string;
    subtab?: string;
    login?: string;
    forbidden?: string;
  }>;
}) {
  const { department } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};

  // =========================================================
  // 1. FORMAT PATH
  // =========================================================
  const cleanSubdomain = decodeURIComponent(department).toLowerCase().trim();
  const basePath = `/department/${encodeURIComponent(cleanSubdomain)}`;

  // =========================================================
  // 2. FIND ORGANIZATION
  // =========================================================
  const organization = await prisma.organization.findUnique({
    where: {
      subdomain: cleanSubdomain,
    },
  });

  if (!organization) {
    return (
      <div className="container p-4">
        <div className="alert alert-danger shadow-sm border-secondary">
          <h4 className="fw-bold mb-2">Entity Not Found</h4>
          <p className="small mb-0">
            The registered entity "{cleanSubdomain}" does not exist in the database.
          </p>
        </div>
      </div>
    );
  }

  // =========================================================
  // 3. DYNAMIC ACADEMIC YEAR & TERM (DATABASE LINKED)
  // =========================================================
  const ay = resolvedSearch.ay || organization.activeAy || "A.Y. 2026 - 2027";
  const term = resolvedSearch.term || organization.activeTerm || "1st Sem";
  const subtab = resolvedSearch.subtab || "advances";

  const queryString = `?ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}`;

  // =========================================================
  // 4. SESSION
  // =========================================================
  const session = await auth();
  const isAuthenticated = Boolean(session?.user);

  // =========================================================
  // 5. PREMIUM UNAUTHENTICATED ENTRY (PUBLIC TENANT PORTAL)
  // =========================================================
  if (!isAuthenticated) {
    return (
      <>
        <div className="container py-5 d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
          <div
            className="card border-secondary shadow-lg bg-card p-4 p-md-5 text-center mx-auto w-100 position-relative overflow-hidden"
            style={{ maxWidth: "650px", borderRadius: "1.25rem" }}
          >
            {/* Subtle background glow effect */}
            <div className="position-absolute top-0 start-50 translate-middle-x w-100 h-50" style={{ background: 'radial-gradient(ellipse at top, rgba(56,189,248,0.15), transparent 70%)', zIndex: 0 }}></div>
            
            <div className="mb-4 position-relative" style={{ zIndex: 1 }}>
              <div className="d-inline-flex align-items-center justify-content-center bg-dark border border-secondary rounded-circle mb-3 shadow" style={{ width: '100px', height: '100px', padding: '15px' }}>
                {/* ❌ REMOVED THE onError EVENT HANDLER TO FIX THE SERVER COMPONENT ERROR */}
                <img 
                  src={`/${cleanSubdomain}_logo.png`} 
                  alt={`${organization.name} Logo`} 
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              
              <h3 className="fw-bold text-white mb-2" style={{ lineHeight: '1.3' }}>
                {organization.name}
              </h3>
              <p className="text-secondary mb-0 mx-auto" style={{ maxWidth: '85%' }}>
                Welcome to the Centralized Liquidation of Expenses & Audit Records (CLEAR) System.
              </p>
            </div>

            {resolvedSearch.login === "true" && (
              <div className="alert alert-info text-start small border-info shadow-sm position-relative" style={{ zIndex: 1 }}>
                <i className="bi bi-info-circle me-2"></i>
                Please authenticate using your registered institutional email.
              </div>
            )}

            {resolvedSearch.forbidden === "true" && (
              <div className="alert alert-danger text-start small border-danger shadow-sm position-relative" style={{ zIndex: 1 }}>
                <i className="bi bi-shield-exclamation me-2"></i>
                You are not authorized to access this {organization.type.toLowerCase()}.
              </div>
            )}

            <div className="row g-3 mt-2 position-relative" style={{ zIndex: 1 }}>
              <div className="col-12 col-sm-6">
                <Link
                  href={`${basePath}/clearance${queryString}`}
                  className="btn btn-outline-info w-100 h-100 p-3 d-flex flex-column align-items-center justify-content-center rounded-3 bg-dark"
                  style={{ transition: 'all 0.2s ease', border: '1px solid rgba(56,189,248,0.3)' }}
                >
                  <i className="bi bi-person-check fs-2 mb-2"></i>
                  <span className="fw-bold">Student Clearance</span>
                  <small className="text-secondary mt-1" style={{ fontSize: '0.75rem' }}>Public Verification</small>
                </Link>
              </div>

              <div className="col-12 col-sm-6">
                <button
                  type="button"
                  className="btn btn-info w-100 h-100 p-3 d-flex flex-column align-items-center justify-content-center rounded-3 text-dark shadow"
                  style={{ transition: 'all 0.2s ease' }}
                  data-bs-toggle="modal"
                  data-bs-target="#otpAuthModal"
                >
                  <i className="bi bi-shield-lock-fill fs-2 mb-2"></i>
                  <span className="fw-bold">Officer Login</span>
                  <small className="text-dark opacity-75 mt-1" style={{ fontSize: '0.75rem' }}>Secure Access</small>
                </button>
              </div>
            </div>

            <div className="mt-5 pt-3 border-top border-secondary position-relative" style={{ zIndex: 1 }}>
              <Link
                href="/dashboard"
                className="text-secondary small text-decoration-none hover-info"
              >
                <i className="bi bi-arrow-left me-1"></i>
                Back to System Gateway
              </Link>
            </div>
          </div>
        </div>
        <OtpModal department={cleanSubdomain} />
      </>
    );
  }

  // =========================================================
  // 6. AUTHENTICATED USERS (PREMIUM FINANCIAL DASHBOARD)
  // =========================================================

  const overview = await getDepartmentFinancials(
    organization.id,
    ay,
    term
  );

  return (
    <>
      {/* INLINE CSS FOR PREMIUM DASHBOARD COMPONENTS */}
      <style dangerouslySetInnerHTML={{__html: `
        .stat-card {
          background-color: #1e293b;
          border: 1px solid #334155;
          border-radius: 1rem;
          padding: 1.25rem;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .stat-card:hover {
          transform: translateY(-5px);
          border-color: #38bdf8;
          box-shadow: 0 10px 20px rgba(0,0,0,0.25);
        }
        .stat-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          margin-bottom: 1rem;
        }
        .quick-action-btn {
          background-color: #0f172a;
          border: 1px solid #334155;
          border-radius: 0.75rem;
          color: #94a3b8;
          transition: all 0.2s ease;
        }
        .quick-action-btn:hover {
          background-color: #1e293b;
          border-color: #38bdf8;
          color: #38bdf8;
        }
      `}} />

      <div className="d-flex flex-column gap-4">
        
        {/* DYNAMIC HEADER */}
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-3">
          <div>
            <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 px-2 py-1 mb-2 shadow-sm text-uppercase">
              <i className={`me-1 ${organization.type === 'Organization' ? 'bi bi-people-fill' : 'bi bi-building'}`}></i>
              {organization.type || 'Department'} Workspace
            </span>
            <h4 className="fw-bold mb-1 text-white">
              {organization.name}
            </h4>
            <p className="text-secondary small mb-0">
              Financial Overview & Active Insights for {ay} | {term}
            </p>
          </div>
        </div>

        {/* QUICK ACTIONS ROW */}
        <div className="row g-2">
          <div className="col-6 col-md-3">
            <Link href={`${basePath}/collections${queryString}`} className="quick-action-btn w-100 text-decoration-none d-flex align-items-center p-2 gap-2 shadow-sm">
              <div className="bg-info bg-opacity-10 text-info rounded p-1"><i className="bi bi-cash-stack fs-5"></i></div>
              <span className="small fw-semibold">Log Collection</span>
            </Link>
          </div>
          <div className="col-6 col-md-3">
            <Link href={`${basePath}/remittances${queryString}`} className="quick-action-btn w-100 text-decoration-none d-flex align-items-center p-2 gap-2 shadow-sm">
              <div className="bg-success bg-opacity-10 text-success rounded p-1"><i className="bi bi-upload fs-5"></i></div>
              <span className="small fw-semibold">Remittance Queue</span>
            </Link>
          </div>
          <div className="col-6 col-md-3">
            <Link href={`${basePath}/advances${queryString}`} className="quick-action-btn w-100 text-decoration-none d-flex align-items-center p-2 gap-2 shadow-sm">
              <div className="bg-warning bg-opacity-10 text-warning rounded p-1"><i className="bi bi-journal-arrow-up fs-5"></i></div>
              <span className="small fw-semibold">Issue Advance</span>
            </Link>
          </div>
          <div className="col-6 col-md-3">
            <Link href={`${basePath}/clearance${queryString}`} className="quick-action-btn w-100 text-decoration-none d-flex align-items-center p-2 gap-2 shadow-sm">
              <div className="bg-secondary bg-opacity-25 text-white rounded p-1"><i className="bi bi-person-check fs-5"></i></div>
              <span className="small fw-semibold">Verify Clearance</span>
            </Link>
          </div>
        </div>

        {/* PREMIUM KPI CARDS */}
        <div className="row g-3">
          
          <div className="col-6 col-lg-3">
            <div className="stat-card">
              <div className="stat-icon bg-info bg-opacity-10 text-info">
                <i className="bi bi-wallet2"></i>
              </div>
              <small className="text-secondary text-uppercase fw-bold mb-1" style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}>
                Total Collections
              </small>
              <div className="fs-4 fw-bold text-white mt-auto">
                {fmt(overview.grandCollectionTotal)}
              </div>
            </div>
          </div>

          <div className="col-6 col-lg-3">
            <div className="stat-card">
              <div className="stat-icon bg-warning bg-opacity-10 text-warning">
                <i className="bi bi-journal-arrow-up"></i>
              </div>
              <small className="text-secondary text-uppercase fw-bold mb-1" style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}>
                Active Unliquidated
              </small>
              <div className="fs-4 fw-bold text-warning mt-auto">
                {fmt(overview.totalUnliquidated)}
              </div>
            </div>
          </div>

          <div className="col-6 col-lg-3">
            <div className="stat-card">
              <div className="stat-icon bg-danger bg-opacity-10 text-danger">
                <i className="bi bi-receipt"></i>
              </div>
              <small className="text-secondary text-uppercase fw-bold mb-1" style={{ fontSize: "0.7rem", letterSpacing: "0.5px" }}>
                Audited Expenses
              </small>
              <div className="fs-4 fw-bold text-white mt-auto">
                {fmt(overview.grandExpenseTotal)}
              </div>
            </div>
          </div>

          <div className="col-6 col-lg-3">
            <div className="stat-card position-relative overflow-hidden">
              <div className="position-absolute top-0 end-0 p-3 opacity-25">
                <i className="bi bi-bank" style={{ fontSize: '4rem', color: overview.remainingBalance >= 0 ? '#22c55e' : '#ef4444' }}></i>
              </div>
              <div className={`stat-icon bg-opacity-10 ${overview.remainingBalance >= 0 ? 'bg-success text-success' : 'bg-danger text-danger'}`}>
                <i className="bi bi-safe2"></i>
              </div>
              <small className="text-secondary text-uppercase fw-bold mb-1" style={{ fontSize: "0.7rem", letterSpacing: "0.5px", zIndex: 1 }}>
                Net Treasury Balance
              </small>
              <div className={`fs-4 fw-bold mt-auto ${overview.remainingBalance >= 0 ? "text-success" : "text-danger"}`} style={{ zIndex: 1 }}>
                {fmt(overview.remainingBalance)}
              </div>
            </div>
          </div>

        </div>

        {/* WIDGET PANEL */}
        <div className="card p-3 p-md-4 border-secondary shadow-sm bg-card mt-2">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
            <h6 className="fw-bold text-white m-0">
              {subtab === "funds" ? (
                <><i className="bi bi-wallet me-2 text-info"></i> Individual Fund Allocations</>
              ) : (
                <><i className="bi bi-clock-history me-2 text-warning"></i> Pending Cash Advances</>
              )}
            </h6>

            <div className="btn-group btn-group-sm rounded shadow-sm" role="group">
              <Link
                href={`${basePath}${queryString}&subtab=advances`}
                className={`btn ${subtab === "advances" ? "btn-info text-dark fw-bold" : "btn-outline-secondary"}`}
              >
                Pending Advances
              </Link>
              <Link
                href={`${basePath}${queryString}&subtab=funds`}
                className={`btn ${subtab === "funds" ? "btn-info text-dark fw-bold" : "btn-outline-secondary"}`}
              >
                Fund Balances
              </Link>
            </div>
          </div>

          {/* FUNDS TABLE */}
          {subtab === "funds" ? (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 text-white" style={{ fontSize: '0.9rem' }}>
                <thead>
                  <tr className="text-secondary small border-bottom border-secondary">
                    <th className="py-2">Account Pool</th>
                    <th className="text-end py-2">Allocated Collections</th>
                    <th className="text-end py-2">Disbursed (Unliquidated)</th>
                    <th className="text-end py-2">Liquidated Expenses</th>
                    <th className="text-end py-2">Available Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.fundsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-5 text-secondary">
                        <i className="bi bi-wallet2 fs-2 d-block mb-2 opacity-50"></i>
                        No fund activity recorded for this term.
                      </td>
                    </tr>
                  ) : (
                    overview.fundsList.map((f: any) => (
                      <tr key={f.name} className="border-bottom border-secondary">
                        <td className="py-3"><strong>{f.name}</strong></td>
                        <td className="text-end text-info py-3">{fmt(f.collected)}</td>
                        <td className="text-end text-warning py-3">{fmt(f.unliquidated)}</td>
                        <td className="text-end text-danger py-3">{fmt(f.spent)}</td>
                        <td className={`text-end fw-bold py-3 ${f.balance < 0 ? "text-danger" : "text-success"}`}>
                          {fmt(f.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* ADVANCES TABLE */
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 text-white" style={{ fontSize: '0.9rem' }}>
                <thead>
                  <tr className="text-secondary small border-bottom border-secondary">
                    <th className="py-2">Advance ID</th>
                    <th className="py-2">Date Issued</th>
                    <th className="py-2">Requestor</th>
                    <th className="py-2">Fund Source</th>
                    <th className="text-end py-2">Amount Approved</th>
                    <th className="py-2">Status</th>
                    <th className="text-center py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.unliquidatedAdvances.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-5 text-secondary">
                        <i className="bi bi-check-circle fs-2 d-block mb-2 opacity-50 text-success"></i>
                        No pending unliquidated cash advances for this term.
                      </td>
                    </tr>
                  ) : (
                    overview.unliquidatedAdvances.map((ca: any) => (
                      <tr key={ca.id} className="border-bottom border-secondary">
                        <td className="font-monospace text-secondary py-3">{ca.id}</td>
                        <td className="py-3">{ca.date}</td>
                        <td className="py-3"><strong className="text-accent">{ca.requestor}</strong></td>
                        <td className="py-3">{ca.fund}</td>
                        <td className="text-end text-warning fw-bold py-3">{fmt(ca.amount)}</td>
                        <td className="py-3"><span className="badge bg-warning text-dark">{ca.status}</span></td>
                        <td className="text-center py-3">
                          <Link
                            href={`${basePath}/liquidations?caId=${encodeURIComponent(ca.id)}&ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}`}
                            className="btn btn-outline-info btn-sm py-1 fw-bold"
                          >
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