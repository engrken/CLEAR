import { prisma } from '@/lib/prisma';
import { getDepartmentFinancials } from './actions';
import { format } from 'date-fns';
import { fmt } from '@/lib/utils';
import Link from 'next/link';

export default async function DepartmentOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string; subtab?: string }>;
}) {
  const { department } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const ay = resolvedSearch.ay || 'A.Y. 2026 - 2027';
  const term = resolvedSearch.term || '1st Sem';
  const subtab = resolvedSearch.subtab || 'funds';
  const baseUrl = `http://${department}.localhost:3000`;

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department },
  });

  if (!organization) {
    return (
      <div className="alert alert-danger p-4 shadow-sm border-secondary">
        <h4 className="fw-bold mb-2">Department Not Found</h4>
        <p className="small mb-0">The department '{decodeURIComponent(department)}' does not exist.</p>
      </div>
    );
  }

  // CALLS THE EXACT SAME UNIFIED ENGINE AS THE SUMMARY PAGE (Guarantees 100% Parity)
  const overview = await getDepartmentFinancials(organization.id, ay, term);

  return (
    <div className="module card p-3 p-md-4 border-secondary shadow-sm">
      <div className="d-flex justify-content-between align-items-start align-items-md-center flex-wrap gap-3 mb-4">
        <div>
          <h4 className="fw-bold mb-1">Financial Overview Dashboard</h4>
          <p className="text-secondary small mb-0">Here's an overview of department collections, liquidations, and fund allocations ({ay} | {term}).</p>
        </div>
        
      </div>

      {/* 5 KPI STAT CARDS (100% Synchronized with Summary Report) */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-4 col-xl">
          <div className="stat-card">
            <div className="stat-card-icon bg-info bg-opacity-10 text-info"><i className="bi bi-wallet2"></i></div>
            <small className="text-secondary text-uppercase fw-bold d-block mb-1" style={{ fontSize: '0.7rem' }}>Collections</small>
            <div className="fs-5 fw-bold text-accent">{fmt(overview.grandCollectionTotal)}</div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-xl">
          <div className="stat-card border-warning">
            <div className="stat-card-icon bg-warning bg-opacity-10 text-warning"><i className="bi bi-journal-arrow-up"></i></div>
            <small className="text-secondary text-uppercase fw-bold d-block mb-1" style={{ fontSize: '0.7rem' }}>Unliquidated</small>
            <div className="fs-5 fw-bold text-warning">{fmt(overview.totalUnliquidated)}</div>
          </div>
        </div>
        <div className="col-6 col-md-4 col-xl">
          <div className="stat-card">
            <div className="stat-card-icon bg-danger bg-opacity-10 text-danger"><i className="bi bi-receipt"></i></div>
            <small className="text-secondary text-uppercase fw-bold d-block mb-1" style={{ fontSize: '0.7rem' }}>Liquidated Expenses</small>
            <div className="fs-5 fw-bold text-danger">{fmt(overview.grandExpenseTotal)}</div>
          </div>
        </div>
        <div className="col-6 col-md-6 col-xl">
          <div className="stat-card">
            <div className="stat-card-icon bg-success bg-opacity-10 text-success"><i className="bi bi-check2-circle"></i></div>
            <small className="text-secondary text-uppercase fw-bold d-block mb-1" style={{ fontSize: '0.7rem' }}>Remaining Balance</small>
            <div className={`fs-5 fw-bold ${overview.remainingBalance >= 0 ? 'text-success' : 'text-danger'}`}>
              {fmt(overview.remainingBalance)}
            </div>
          </div>
        </div>
        <div className="col-12 col-md-6 col-xl">
          <div className="stat-card">
            <div className="stat-card-icon bg-warning bg-opacity-10 text-warning"><i className="bi bi-inbox"></i></div>
            <small className="text-secondary text-uppercase fw-bold d-block mb-1" style={{ fontSize: '0.7rem' }}>Collectibles & Receivables</small>
            <div className="fs-5 fw-bold text-warning">{fmt(overview.totalCollectibles)}</div>
          </div>
        </div>
      </div>

      {/* WIDGET PANEL */}
      <div className="card p-3 border-secondary">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
          <h6 className="fw-bold text-secondary m-0">
            {subtab === 'funds' ? (
              <><i className="bi bi-wallet me-1 text-accent"></i>Individual Fund Account Balances</>
            ) : (
              <><i className="bi bi-journal-arrow-up me-1 text-warning"></i>Unliquidated Expenses (Active Cash Advances)</>
            )}
          </h6>
          <div className="btn-group btn-group-sm" role="group">
            <Link 
              href={`${baseUrl}?ay=${ay}&term=${term}&subtab=advances`} 
              className={`btn ${subtab === 'advances' ? 'btn-outline-info active' : 'btn-outline-secondary'}`}
            >
              Unliquidated Advances
            </Link>
            <Link 
              href={`${baseUrl}?ay=${ay}&term=${term}&subtab=funds`} 
              className={`btn ${subtab === 'funds' ? 'btn-outline-info active' : 'btn-outline-secondary'}`}
            >
              Fund Account Balances
            </Link>
          </div>
        </div>

        {subtab === 'funds' ? (
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
                  <tr><td colSpan={5} className="text-center py-4 text-secondary">No fund activity recorded for this term.</td></tr>
                ) : (
                  overview.fundsList.map((f: any) => (
                    <tr key={f.name}>
                      <td><strong>{f.name}</strong></td>
                      <td className="text-end text-accent">{fmt(f.collected)}</td>
                      <td className="text-end text-warning">{fmt(f.unliquidated)}</td>
                      <td className="text-end text-danger">{fmt(f.spent)}</td>
                      <td className={`text-end fw-bold ${f.balance < 0 ? 'text-danger' : 'text-success'}`}>
                        {fmt(f.balance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
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
                  <tr><td colSpan={7} className="text-center py-4 text-secondary">No pending unliquidated cash advances for this term.</td></tr>
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
                        <Link href={`${baseUrl}/liquidations?caId=${ca.id}`} className="btn btn-outline-info btn-sm py-0">Liquidate</Link>
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