"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PRESET_ROLE_TABS } from "@/lib/role-permissions";
import { DEMO_FUNDS, DEMO_MODULES, DEMO_VIEWS, type DemoModuleId, type DemoRow } from "@/lib/demo-workspace-data";

type DemoRole = "admin" | "treasurer" | "auditor" | "viewer" | "officer";
const ROLE_OPTIONS: { value: DemoRole; label: string; detail: string }[] = [
  { value: "admin", label: "Administrator", detail: "All tenant modules (not Global Administrator)" },
  { value: "treasurer", label: "Treasurer", detail: "Collections, treasury and reporting" },
  { value: "auditor", label: "Auditor", detail: "Financial audit and reporting" },
  { value: "viewer", label: "Viewer", detail: "Read-focused overview and reports" },
  { value: "officer", label: "Officer", detail: "Default permissions; real grants can differ" },
];
const CATEGORIES = ["Core", "Operations", "Audit & Reporting", "Administration"] as const;
const MONEY = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

function hasDemoAccess(role: DemoRole, tab: string): boolean {
  if (tab === "admin-only") return role === "admin";
  const preset = role === "officer" ? PRESET_ROLE_TABS.viewer : PRESET_ROLE_TABS[role];
  return preset.includes(tab);
}

function statusStyle(status: string): string {
  if (/cleared|approved|verified|paid|active|recorded|available|configured|settled/i.test(status) && !/not cleared|unpaid/i.test(status)) return "bg-success bg-opacity-10 text-success border-success";
  if (/void|reject|cancel/i.test(status)) return "bg-danger bg-opacity-10 text-danger border-danger";
  return "bg-warning bg-opacity-10 text-warning border-warning";
}

function TinyMetric({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="col-6 col-xl-3">
      <div className="card p-3 h-100 border-secondary">
        <div className="text-info mb-2"><i className={"bi " + icon + " fs-4"} aria-hidden="true" /></div>
        <div className="text-secondary text-uppercase small fw-semibold">{label}</div>
        <div className="fs-4 fw-bold mt-2">{value}</div>
      </div>
    </div>
  );
}

export default function DemoPage() {
  const [role, setRole] = useState<DemoRole>("admin");
  const [module, setModule] = useState<DemoModuleId>("overview");
  const [academicYear, setAcademicYear] = useState("A.Y. 2026 - 2027");
  const [term, setTerm] = useState("1st Sem");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [ledgerTab, setLedgerTab] = useState<"funds" | "advances">("funds");
  const [details, setDetails] = useState<DemoRow | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const currentModule = DEMO_MODULES.find((item) => item.id === module) || DEMO_MODULES[0];
  const currentRole = ROLE_OPTIONS.find((item) => item.value === role) || ROLE_OPTIONS[0];
  const view = module === "overview" ? null : DEMO_VIEWS[module];
  const filters = useMemo(() => view ? ["All", ...new Set(view.rows.map((item) => item.status))] : ["All"], [view]);
  const visibleRows = useMemo(() => view ? view.rows.filter((item) =>
    (statusFilter === "All" || item.status === statusFilter) &&
    [item.id, ...item.cells, item.details].join(" ").toLowerCase().includes(search.toLowerCase().trim())
  ) : [], [view, statusFilter, search]);

  const chooseModule = (id: DemoModuleId) => {
    const target = DEMO_MODULES.find((item) => item.id === id);
    if (!target || !hasDemoAccess(role, target.tab)) return;
    setModule(id);
    setSearch("");
    setStatusFilter("All");
    setLedgerTab("funds");
    setDetails(null);
    setSidebarOpen(false);
    setShowGuide(false);
  };
  const chooseRole = (next: DemoRole) => {
    setRole(next);
    setModule("overview");
    setSearch("");
    setStatusFilter("All");
    setDetails(null);
    setShowGuide(false);
  };

  return (
    <div className="demo-workspace min-vh-100 bg-canvas text-body">
      <style>{`
        .demo-workspace { --demo-sidebar-width: 276px; }
        .demo-workspace .demo-layout { display: flex; align-items: stretch; min-height: 100vh; }
        .demo-workspace .demo-sidebar { flex: 0 0 var(--demo-sidebar-width); width: var(--demo-sidebar-width); position: sticky; top: 0; height: 100vh; overflow-y: auto; z-index: 1010; }
        .demo-workspace .demo-content { min-width: 0; flex: 1; }
        .demo-workspace .demo-nav-button { width: 100%; border: 1px solid transparent; border-radius: 0.45rem; background: transparent; color: var(--text-muted); display: flex; align-items: center; padding: 0.7rem 0.85rem; gap: 0.8rem; text-align: left; font-size: 0.86rem; }
        .demo-workspace .demo-nav-button:hover { color: var(--text-color); background: rgba(var(--accent-rgb),0.08); }
        .demo-workspace .demo-nav-button[aria-current="page"] { color: var(--accent); background: rgba(var(--accent-rgb),0.15); border-left: 4px solid var(--accent); font-weight: 700; }
        .demo-workspace .demo-nav-group { font-size: 0.65rem; letter-spacing: 0.09em; font-weight: 700; color: var(--text-muted); text-transform: uppercase; padding: 1.15rem 0.8rem 0.35rem; }
        .demo-workspace .demo-topbar { position: sticky; top: 0; z-index: 1000; background: var(--bg-surface); border-bottom: 1px solid var(--border-color); }
        .demo-workspace .demo-kpi { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 0.85rem; padding: 1.25rem; height: 100%; }
        .demo-workspace .demo-action { border: 1px solid var(--border-color); border-radius: 0.7rem; background: var(--bg-card); color: var(--text-color); padding: 0.8rem; width: 100%; text-align: left; }
        .demo-workspace .demo-action:hover { border-color: var(--accent); }
        .demo-workspace .demo-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.72); z-index: 1100; display: grid; place-items: center; padding: 1rem; }
        .demo-workspace .demo-dialog { max-width: 580px; width: 100%; max-height: 88vh; overflow: auto; }
        .demo-workspace .demo-role-select { max-width: 210px; }
        @media (max-width: 991.98px) {
          .demo-workspace .demo-sidebar { position: fixed; left: 0; transform: translateX(-100%); transition: transform 0.18s ease; }
          .demo-workspace .demo-sidebar.show { transform: translateX(0); z-index: 1071; }
          .demo-workspace .demo-mobile-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.56); z-index: 1070; }
        }
      `}</style>

      <div className="demo-layout">
        {sidebarOpen && <button type="button" className="demo-mobile-backdrop d-lg-none border-0" onClick={() => setSidebarOpen(false)} aria-label="Close demo navigation" />}
        <aside className={"demo-sidebar border-end border-secondary bg-card p-3 d-flex flex-column " + (sidebarOpen ? "show" : "")} aria-label="CLEAR demo modules">
          <div className="d-flex align-items-center gap-2 px-2 py-2 border-bottom border-secondary mb-2">
            <div className="rounded p-2 bg-info bg-opacity-10 text-info"><i className="bi bi-shield-check fs-4" aria-hidden="true" /></div>
            <div className="overflow-hidden">
              <div className="fw-bold text-info">CLEAR System</div>
              <div className="text-secondary small">EXAMPLE CAMPUS ORGANIZATION</div>
            </div>
          </div>
          <span className="badge bg-warning text-dark align-self-start ms-2 my-2">DEMO • FICTIONAL DATA</span>
          <nav className="flex-grow-1" aria-label="Sample organization navigation">
            {CATEGORIES.map((category) => {
              const items = DEMO_MODULES.filter((item) => item.category === category && hasDemoAccess(role, item.tab));
              if (items.length === 0) return null;
              return (
                <div key={category}>
                  <div className="demo-nav-group">{category}</div>
                  {items.map((item) => (
                    <button type="button" key={item.id} className="demo-nav-button"
                      aria-current={module === item.id ? "page" : undefined} onClick={() => chooseModule(item.id)}>
                      <i className={"bi " + item.icon} aria-hidden="true" /><span>{item.label}</span>
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
          <div className="border-top border-secondary px-2 pt-3 mt-3">
            <Link href="/" className="small text-info text-decoration-none"><i className="bi bi-arrow-left me-2" />Back to landing page</Link>
          </div>
        </aside>

        <div className="demo-content d-flex flex-column">
          <header className="demo-topbar px-3 px-xl-4 py-3">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div className="d-flex align-items-center gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm d-lg-none" onClick={() => setSidebarOpen(true)} aria-label="Open demo navigation"><i className="bi bi-list" /></button>
                <div>
                  <div className="fw-bold">Centralized Liquidation of Expenses &amp; Audit Records System</div>
                  <div className="small text-secondary">Example Campus Organization · {currentModule.label}</div>
                </div>
              </div>
              <div className="d-flex flex-wrap align-items-center gap-2">
                <label className="visually-hidden" htmlFor="demo-academic-year">Academic year</label>
                <select id="demo-academic-year" className="form-select form-select-sm" style={{ width: "170px" }} value={academicYear} onChange={(event) => setAcademicYear(event.target.value)}>
                  <option>A.Y. 2026 - 2027</option><option>A.Y. 2025 - 2026</option>
                </select>
                <label className="visually-hidden" htmlFor="demo-term">Academic term</label>
                <select id="demo-term" className="form-select form-select-sm" style={{ width: "108px" }} value={term} onChange={(event) => setTerm(event.target.value)}>
                  <option>1st Sem</option><option>2nd Sem</option>
                </select>
                <label className="visually-hidden" htmlFor="demo-role">Demonstration role</label>
                <select id="demo-role" value={role} onChange={(event) => chooseRole(event.target.value as DemoRole)} className="form-select form-select-sm demo-role-select" title="Switch simulated tenant permissions">
                  {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
            </div>
          </header>

          <main className="p-3 p-md-4 flex-grow-1">
            <div className="alert alert-info border-info small d-flex gap-2 mb-4" role="status">
              <i className="bi bi-shield-lock flex-shrink-0" aria-hidden="true" />
              <span><strong>Read-only demo:</strong> All names, receipts, balances and logs are fictional. Navigation, search, filtering, and record previews work here; payments, uploads, exports and changes to records do not.</span>
            </div>
            <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
              <div>
                <div className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25 mb-2 text-uppercase">Organization Workspace</div>
                <h1 className="h3 fw-bold mb-1">{module === "overview" ? "Example Campus Organization" : currentModule.label}</h1>
                <p className="small text-secondary mb-0">{module === "overview" ? "Financial Analytics & Active Insights" : currentModule.description} for {academicYear} | {term}</p>
              </div>
              <div className="d-flex flex-column align-items-start align-items-md-end gap-1">
                <span className="badge border border-info text-info bg-info bg-opacity-10">{currentRole.label} preview</span>
                <span className="small text-secondary">{currentRole.detail}</span>
              </div>
            </div>
            {module === "overview" ? (
              <div className="d-flex flex-column gap-4">
                <div className="row g-2">
                  {([
                    ["Log Collection", "collections", "bi-cash-stack"],
                    ["Univ. Cashier", "cashier-remittance", "bi-safe2"],
                    ["Issue Advance", "advances", "bi-journal-arrow-up"],
                    ["Full Reports", "reports", "bi-bar-chart-fill"]
                  ] as [string, DemoModuleId, string][]).filter(([, id]) => {
                    const target = DEMO_MODULES.find((item) => item.id === id);
                    return target && hasDemoAccess(role, target.tab);
                  }).map(([label, id, icon]) => (
                    <div className="col-6 col-lg-3" key={id}>
                      <button type="button" className="demo-action d-flex align-items-center gap-2 h-100" onClick={() => chooseModule(id)}>
                        <i className={"bi " + icon + " fs-4 text-info"} aria-hidden="true" />
                        <span className="fw-semibold small">{label}</span>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="row g-3">
                  <TinyMetric label="Total Collections" value={MONEY.format(12500)} icon="bi-wallet2" />
                  <TinyMetric label="Active Unliquidated" value={MONEY.format(1200)} icon="bi-journal-arrow-up" />
                  <TinyMetric label="Audited Expenses" value={MONEY.format(4600)} icon="bi-receipt" />
                  <TinyMetric label="Net Treasury Balance" value={MONEY.format(6700)} icon="bi-bank" />
                </div>
                <div className="row g-3">
                  <div className="col-12 col-lg-6">
                    <div className="card p-3 p-md-4 h-100 border-info">
                      <div className="text-info text-uppercase fw-bold"><i className="bi bi-safe2-fill me-2" />University Cashier</div>
                      <small className="text-secondary">Funds currently in safekeeping</small>
                      <div className="fs-3 fw-bold text-info mt-2">{MONEY.format(4000)}</div>
                      <div className="small text-success">Deposited {MONEY.format(4000)} · Withdrawn {MONEY.format(0)}</div>
                    </div>
                  </div>
                  <div className="col-12 col-lg-6">
                    <div className="card p-3 p-md-4 h-100 border-secondary">
                      <div className="text-uppercase fw-bold"><i className="bi bi-cash me-2 text-success" />Physical Cash on Hand</div>
                      <small className="text-secondary">Net treasury balance less cashier safekeeping</small>
                      <div className="fs-3 fw-bold text-success mt-2">{MONEY.format(2700)}</div>
                    </div>
                  </div>
                </div>
                <div className="row g-3">
                  <div className="col-12 col-xl-5">
                    <div className="card p-3 p-md-4 border-secondary h-100">
                      <h2 className="h6 fw-bold mb-3">Available Target Funds</h2>
                      {DEMO_FUNDS.map((fund) => (
                        <div className="mb-3" key={fund.name}>
                          <div className="d-flex justify-content-between small mb-1"><span>{fund.name}</span><strong>{MONEY.format(fund.balance)}</strong></div>
                          <div className="progress" style={{ height: "12px" }}><div className="progress-bar bg-info" style={{ width: Math.round(fund.balance / 6700 * 100) + "%" }} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="col-12 col-xl-7">
                    <div className="card p-3 p-md-4 border-secondary h-100">
                      <h2 className="h6 fw-bold mb-3">Cash Flow Velocity</h2>
                      {[["Total Collected", 12500, "bg-info"], ["Audited Expenses", 4600, "bg-danger"], ["Active Advances (Unliquidated)", 1200, "bg-warning"]].map(([label, value, color]) => (
                        <div className="mb-3" key={String(label)}>
                          <div className="d-flex justify-content-between small mb-1"><span>{label}</span><strong>{MONEY.format(Number(value))}</strong></div>
                          <div className="progress" style={{ height: "16px" }}><div className={"progress-bar " + color} style={{ width: Math.round(Number(value) / 12500 * 100) + "%" }} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="card p-3 p-md-4 border-secondary">
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                    <h2 className="h6 fw-bold m-0">{ledgerTab === "funds" ? "Detailed Ledger" : "Pending Advances"}</h2>
                    <div className="btn-group btn-group-sm">
                      <button type="button" onClick={() => setLedgerTab("funds")} className={"btn " + (ledgerTab === "funds" ? "btn-info" : "btn-outline-secondary")}>Fund Balances</button>
                      <button type="button" onClick={() => setLedgerTab("advances")} className={"btn " + (ledgerTab === "advances" ? "btn-info" : "btn-outline-secondary")}>Pending Advances</button>
                    </div>
                  </div>
                  <div className="table-responsive">
                    {ledgerTab === "funds" ? (
                      <table className="table table-hover align-middle"><thead><tr><th>Account Pool</th><th>Initial / Rollover</th><th>Net Transfers</th><th>Collected</th><th>Disbursed</th><th>Balance</th></tr></thead>
                        <tbody>{DEMO_FUNDS.map((fund) => <tr key={fund.name}><td className="fw-semibold">{fund.name}</td><td>{MONEY.format(fund.opening)}</td><td>{MONEY.format(fund.transfers)}</td><td>{MONEY.format(fund.collected)}</td><td>{MONEY.format(fund.spent)}</td><td className="text-success fw-bold">{MONEY.format(fund.balance)}</td></tr>)}</tbody>
                      </table>
                    ) : (
                      <table className="table table-hover align-middle"><thead><tr><th>Advance ID</th><th>Requestor</th><th>Amount</th><th>Status</th></tr></thead><tbody><tr><td>DEMO-CA-001</td><td>Alex Santos</td><td>{MONEY.format(1200)}</td><td><span className="badge bg-warning text-dark">Unliquidated</span></td></tr></tbody></table>
                    )}
                  </div>
                </div>
              </div>
            ) : view && (
              <div className="d-flex flex-column gap-3">
                <div className="row g-3">
                  {view.metrics.map(([label, value], index) => <div key={label} className="col-6 col-lg-4"><div className="demo-kpi"><small className="text-secondary text-uppercase fw-semibold">{label}</small><div className={"h4 fw-bold mt-2 mb-0 " + (index === 0 ? "text-info" : "")}>{value}</div></div></div>)}
                </div>
                <div className="card border-secondary p-3 p-md-4">
                  <div className="d-flex flex-wrap justify-content-between gap-2 align-items-center mb-3">
                    <div><h2 className="h5 fw-bold mb-1">{currentModule.label} Register</h2><p className="small text-secondary mb-0">Fictional examples; click any record to inspect sample details.</p></div>
                    <button type="button" onClick={() => setShowGuide(true)} className="btn btn-outline-info btn-sm"><i className="bi bi-eye me-2" />View Workflow Guide</button>
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-12 col-md-8">
                      <label htmlFor="demo-search" className="visually-hidden">Search fictional records</label>
                      <input id="demo-search" type="search" placeholder={"Search " + currentModule.label.toLowerCase() + " records"} className="form-control" value={search} onChange={(event) => setSearch(event.target.value)} />
                    </div>
                    <div className="col-12 col-md-4">
                      <label htmlFor="demo-status-filter" className="visually-hidden">Filter records by status</label>
                      <select id="demo-status-filter" className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>{filters.map((status) => <option key={status}>{status}</option>)}</select>
                    </div>
                  </div>
                  <div className="table-responsive">
                    <table className="table table-hover align-middle">
                      <thead><tr>{view.headings.map((head) => <th scope="col" key={head}>{head}</th>)}<th scope="col">Preview</th></tr></thead>
                      <tbody>{visibleRows.map((row) => <tr key={row.id}>
                        {row.cells.map((cell, index) => <td key={index}>{cell === row.status ? <span className={"badge border " + statusStyle(row.status)}>{cell}</span> : cell}</td>)}
                        <td><button type="button" className="btn btn-outline-info btn-sm" onClick={() => setDetails(row)} aria-label={"View sample details for " + row.id}>Details</button></td>
                      </tr>)}</tbody>
                    </table>
                    {visibleRows.length === 0 && <div className="text-center text-secondary py-4">No matching sample records.</div>}
                  </div>
                  <div className="border-top border-secondary pt-3 mt-2 small text-secondary"><i className="bi bi-info-circle me-2" />{view.hint}</div>
                </div>
              </div>
            )}
            <div className="border-top border-secondary mt-4 pt-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
              <span className="small text-secondary">Public walkthrough only · No credentials, live transactions, or tenant connections</span>
              <Link href="/register/organization" className="btn btn-outline-info btn-sm">Register your organization</Link>
            </div>
          </main>
        </div>
      </div>
      {(details || showGuide) && (
        <div className="demo-overlay" role="presentation" onClick={() => { setDetails(null); setShowGuide(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="demo-dialog-title" className="demo-dialog card border-info p-4 shadow-lg" onClick={(event) => event.stopPropagation()}>
            <div className="d-flex align-items-center justify-content-between gap-2 mb-3">
              <h2 id="demo-dialog-title" className="h5 fw-bold m-0">{details ? details.id : currentModule.label + " workflow"}</h2>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setDetails(null); setShowGuide(false); }}>Close</button>
            </div>
            {details ? (
              <>
                <span className={"badge border align-self-start mb-3 " + statusStyle(details.status)}>{details.status}</span>
                <p className="text-secondary">{details.details}</p>
                <p className="small text-secondary mb-0">Sample record only. No financial posting, editing, or saving takes place in this preview.</p>
              </>
            ) : (
              <>
                <p>{currentModule.description}</p>
                <p className="text-secondary">{view?.hint || "This demonstration illustrates the CLEAR interface using fictional data."}</p>
                <div className="alert alert-warning small mb-0">Full write workflows require an authenticated, separately provisioned test organization. This public demo cannot create, modify, or approve real records.</div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
