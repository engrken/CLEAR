// app/department/[department]/page.tsx

import { prisma } from "@/lib/prisma";
import { getDepartmentFinancials } from "./actions";
import { fmt } from "@/lib/utils";
import Link from "next/link";
import { auth } from "@/auth";
import OtpModal from "./components/OtpModal";
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function DepartmentOverviewPage({
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
  // 1. FORMAT DEPARTMENT PATH
  // =========================================================
  const cleanSubdomain = decodeURIComponent(department).toLowerCase().trim();
  const basePath = `/department/${encodeURIComponent(cleanSubdomain)}`;

  // =========================================================
  // 2. FIND ORGANIZATION (FETCH THIS FIRST)
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
          <h4 className="fw-bold mb-2">Department Not Found</h4>
          <p className="small mb-0">
            The department "{cleanSubdomain}" does not exist in the database.
          </p>
        </div>
      </div>
    );
  }

  // =========================================================
  // 3. DYNAMIC ACADEMIC YEAR & TERM (DATABASE LINKED)
  // =========================================================
  // Uses URL params if present, otherwise falls back to the database defaults!
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
  // 5. UNAUTHENTICATED DEPARTMENT ENTRY (LANDING PAGE)
  // =========================================================
  if (!isAuthenticated) {
    return (
      <>
        <div className="container py-5 d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '80vh' }}>
          <div
            className="card border-secondary shadow-lg bg-card p-4 p-md-5 text-center mx-auto w-100"
            style={{ maxWidth: "650px" }}
          >
            <div className="mb-4">
              <i className="bi bi-building display-4 text-info mb-3 d-block"></i>
              <h3 className="fw-bold text-accent mb-2">
                {organization.name}
              </h3>
              <p className="text-secondary mb-0">
                Welcome to the Centralized Liquidation of Expenses & Audit Records (CLEAR) System.
              </p>
            </div>

            {resolvedSearch.login === "true" && (
              <div className="alert alert-info text-start small">
                <i className="bi bi-info-circle me-2"></i>
                Please authenticate using your registered institutional email.
              </div>
            )}

            {resolvedSearch.forbidden === "true" && (
              <div className="alert alert-danger text-start small">
                <i className="bi bi-shield-exclamation me-2"></i>
                You are not authorized to access this department.
              </div>
            )}

            <div className="row g-3 mt-2">
              {/* PUBLIC STUDENT ACCESS BUTTON */}
              <div className="col-12 col-sm-6">
                <Link
                  href={`${basePath}/clearance${queryString}`}
                  className="btn btn-outline-info w-100 h-100 p-3 d-flex flex-column align-items-center justify-content-center rounded-3"
                  style={{ transition: 'all 0.2s ease' }}
                >
                  <i className="bi bi-person-check fs-2 mb-2"></i>
                  <span className="fw-bold">Student Clearance</span>
                  <small className="text-secondary mt-1" style={{ fontSize: '0.75rem' }}>Public Verification</small>
                </Link>
              </div>

              {/* OFFICER LOGIN BUTTON */}
              <div className="col-12 col-sm-6">
                <button
                  type="button"
                  className="btn btn-info w-100 h-100 p-3 d-flex flex-column align-items-center justify-content-center rounded-3 text-dark"
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

            <div className="mt-5 pt-3 border-top border-secondary">
              <Link
                href="/dashboard"
                className="text-secondary small text-decoration-none"
              >
                <i className="bi bi-arrow-left me-1"></i>
                Back to CLEAR Dashboard
              </Link>
            </div>
          </div>
        </div>

        <OtpModal
          department={cleanSubdomain}
        />
      </>
    );
  }

  // =========================================================
  // 6. AUTHENTICATED USERS (FINANCIAL DASHBOARD)
  // =========================================================

  const overview = await getDepartmentFinancials(
    organization.id,
    ay,
    term
  );

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">

      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-start align-items-md-center flex-wrap gap-3 mb-4">
        <div>
          <h4 className="fw-bold mb-1">
            Financial Overview Dashboard
          </h4>
          <p className="text-secondary small mb-0">
            Here's an overview of department collections, liquidations, and fund allocations ({ay} | {term}).
          </p>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="row g-3 mb-4">

        {/* COLLECTIONS */}
        <div className="col-6 col-md-4 col-xl">
          <div className="stat-card">
            <div className="stat-card-icon bg-info bg-opacity-10 text-info">
              <i className="bi bi-wallet2"></i>
            </div>
            <small className="text-secondary text-uppercase fw-bold d-block mb-1" style={{ fontSize: "0.7rem" }}>
              Collections
            </small>
            <div className="fs-5 fw-bold text-accent">
              {fmt(overview.grandCollectionTotal)}
            </div>
          </div>
        </div>

        {/* UNLIQUIDATED */}
        <div className="col-6 col-md-4 col-xl">
          <div className="stat-card border-warning">
            <div className="stat-card-icon bg-warning bg-opacity-10 text-warning">
              <i className="bi bi-journal-arrow-up"></i>
            </div>
            <small className="text-secondary text-uppercase fw-bold d-block mb-1" style={{ fontSize: "0.7rem" }}>
              Unliquidated
            </small>
            <div className="fs-5 fw-bold text-warning">
              {fmt(overview.totalUnliquidated)}
            </div>
          </div>
        </div>

        {/* LIQUIDATED EXPENSES */}
        <div className="col-6 col-md-4 col-xl">
          <div className="stat-card">
            <div className="stat-card-icon bg-danger bg-opacity-10 text-danger">
              <i className="bi bi-receipt"></i>
            </div>
            <small className="text-secondary text-uppercase fw-bold d-block mb-1" style={{ fontSize: "0.7rem" }}>
              Liquidated Expenses
            </small>
            <div className="fs-5 fw-bold text-danger">
              {fmt(overview.grandExpenseTotal)}
            </div>
          </div>
        </div>

        {/* REMAINING BALANCE */}
        <div className="col-6 col-md-6 col-xl">
          <div className="stat-card">
            <div className="stat-card-icon bg-success bg-opacity-10 text-success">
              <i className="bi bi-check2-circle"></i>
            </div>
            <small className="text-secondary text-uppercase fw-bold d-block mb-1" style={{ fontSize: "0.7rem" }}>
              Remaining Balance
            </small>
            <div className={`fs-5 fw-bold ${overview.remainingBalance >= 0 ? "text-success" : "text-danger"}`}>
              {fmt(overview.remainingBalance)}
            </div>
          </div>
        </div>

        {/* COLLECTIBLES */}
        <div className="col-12 col-md-6 col-xl">
          <div className="stat-card">
            <div className="stat-card-icon bg-warning bg-opacity-10 text-warning">
              <i className="bi bi-inbox"></i>
            </div>
            <small className="text-secondary text-uppercase fw-bold d-block mb-1" style={{ fontSize: "0.7rem" }}>
              Collectibles & Receivables
            </small>
            <div className="fs-5 fw-bold text-warning">
              {fmt(overview.totalCollectibles)}
            </div>
          </div>
        </div>

      </div>

      {/* WIDGET PANEL */}
      <div className="card p-3 border-secondary">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <h6 className="fw-bold text-secondary m-0">
            {subtab === "funds" ? (
              <><i className="bi bi-wallet me-1 text-accent"></i> Individual Fund Account Balances</>
            ) : (
              <><i className="bi bi-journal-arrow-up me-1 text-warning"></i> Unliquidated Expenses (Active Cash Advances)</>
            )}
          </h6>

          <div className="btn-group btn-group-sm" role="group">
            <Link
              href={`${basePath}${queryString}&subtab=advances`}
              className={`btn ${subtab === "advances" ? "btn-outline-info active" : "btn-outline-secondary"}`}
            >
              Unliquidated Advances
            </Link>
            <Link
              href={`${basePath}${queryString}&subtab=funds`}
              className={`btn ${subtab === "funds" ? "btn-outline-info active" : "btn-outline-secondary"}`}
            >
              Fund Account Balances
            </Link>
          </div>
        </div>

        {/* FUNDS TABLE */}
        {subtab === "funds" ? (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr className="text-secondary small">
                  <th>Account Pool</th>
                  <th className="text-end">Allocated Collections</th>
                  <th className="text-end">Disbursed (Unliquidated)</th>
                  <th className="text-end">Liquidated Expenses</th>
                  <th className="text-end">Available Balance</th>
                </tr>
              </thead>
              <tbody>
                {overview.fundsList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-4 text-secondary">
                      No fund activity recorded for this term.
                    </td>
                  </tr>
                ) : (
                  overview.fundsList.map((f: any) => (
                    <tr key={f.name}>
                      <td><strong>{f.name}</strong></td>
                      <td className="text-end text-accent">{fmt(f.collected)}</td>
                      <td className="text-end text-warning">{fmt(f.unliquidated)}</td>
                      <td className="text-end text-danger">{fmt(f.spent)}</td>
                      <td className={`text-end fw-bold ${f.balance < 0 ? "text-danger" : "text-success"}`}>
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
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr className="text-secondary small">
                  <th>Advance ID</th>
                  <th>Date Issued</th>
                  <th>Requestor</th>
                  <th>Fund Source</th>
                  <th className="text-end">Amount Approved</th>
                  <th>Status</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {overview.unliquidatedAdvances.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-secondary">
                      No pending unliquidated cash advances for this term.
                    </td>
                  </tr>
                ) : (
                  overview.unliquidatedAdvances.map((ca: any) => (
                    <tr key={ca.id}>
                      <td><strong>{ca.id}</strong></td>
                      <td>{ca.date}</td>
                      <td><strong className="text-accent">{ca.requestor}</strong></td>
                      <td>{ca.fund}</td>
                      <td className="text-end text-warning fw-bold">{fmt(ca.amount)}</td>
                      <td><span className="badge bg-warning text-dark">{ca.status}</span></td>
                      <td className="text-center">
                        <Link
                          href={`${basePath}/liquidations?caId=${encodeURIComponent(ca.id)}&ay=${encodeURIComponent(ay)}&term=${encodeURIComponent(term)}`}
                          className="btn btn-outline-info btn-sm py-0"
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
  );
}