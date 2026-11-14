"use client";

import Link from "next/link";
import { useState } from "react";

type Role = "Administrator" | "President" | "Treasurer" | "Officer";
type Module = "Overview" | "Students" | "Collections" | "Penalties" | "Liquidations" | "Clearance";
const roles: { name: Role; icon: string; description: string }[] = [
  { name: "Administrator", icon: "bi-gear", description: "Organization configuration and roster oversight" },
  { name: "President", icon: "bi-people", description: "Organization-wide reports and monitoring" },
  { name: "Treasurer", icon: "bi-wallet2", description: "Treasury monitoring and collection workflows" },
  { name: "Officer", icon: "bi-clipboard-check", description: "Student records and clearance assistance" },
];
const modules: Module[] = ["Overview", "Students", "Collections", "Penalties", "Liquidations", "Clearance"];
const students = [
  { id: "DEMO-001", name: "Alex Santos", year: "1st Year", status: "Cleared", balance: "₱0.00" },
  { id: "DEMO-002", name: "Jamie Cruz", year: "2nd Year", status: "Pending", balance: "₱150.00" },
  { id: "DEMO-003", name: "Taylor Reyes", year: "3rd Year", status: "Pending", balance: "₱75.00" },
  { id: "DEMO-004", name: "Sam Garcia", year: "4th Year", status: "Cleared", balance: "₱0.00" },
];
const sample: Record<Exclude<Module, "Overview" | "Students">, { title: string; columns: string[]; rows: string[][] }> = {
  Collections: { title: "Sample collection records", columns: ["Reference", "Student", "Amount", "Status"], rows: [["DEMO-OR-001", "Alex Santos", "₱250.00", "Paid"], ["DEMO-OR-002", "Jamie Cruz", "₱150.00", "Pending"]] },
  Penalties: { title: "Sample penalties", columns: ["Reference", "Student", "Amount", "Status"], rows: [["DEMO-PEN-001", "Jamie Cruz", "₱100.00", "Unpaid"], ["DEMO-PEN-002", "Taylor Reyes", "₱75.00", "Unpaid"]] },
  Liquidations: { title: "Sample liquidations", columns: ["Reference", "Purpose", "Amount", "Status"], rows: [["DEMO-LIQ-001", "Event supplies", "₱1,250.00", "Approved"], ["DEMO-LIQ-002", "Workshop materials", "₱800.00", "Review"]] },
  Clearance: { title: "Sample clearance checks", columns: ["Student", "Result", "Reason", "Term"], rows: [["Alex Santos", "Cleared", "No outstanding balance", "2026–2027"], ["Jamie Cruz", "Not cleared", "Unsettled collection and penalty", "2026–2027"], ["Taylor Reyes", "Not cleared", "Unsettled penalty", "2026–2027"]] },
};

export default function DemoPage() {
  const [role, setRole] = useState<Role>("Officer");
  const [module, setModule] = useState<Module>("Overview");
  const [search, setSearch] = useState("");
  const filtered = students.filter((student) => Object.values(student).join(" ").toLowerCase().includes(search.toLowerCase()));
  return (
    <main className="container py-4 py-lg-5">
      <div className="d-flex flex-wrap justify-content-between gap-3 align-items-center mb-4">
        <div>
          <div className="badge bg-warning text-dark mb-2">PUBLIC SANDBOX · FICTIONAL DATA</div>
          <h1 className="fw-bold mb-1">Explore CLEAR</h1>
          <p className="text-secondary mb-0">Try the role-based interface without an account. No real organization data or transactions are connected.</p>
        </div>
        <Link href="/" className="btn btn-outline-info">Back to CLEAR</Link>
      </div>
      <div className="alert alert-info border-info small" role="status">
        <i className="bi bi-shield-lock me-2" aria-hidden="true" />
        This is a read-only interactive showcase, not a signed-in workspace. Changes, payments, exports and administrator actions are unavailable.
      </div>
      <h2 className="h5 fw-bold mb-3">Choose a demonstration role</h2>
      <div className="row g-3 mb-4">
        {roles.map((item) => (
          <div className="col-12 col-sm-6 col-xl-3" key={item.name}>
            <button type="button" aria-pressed={role === item.name} onClick={() => { setRole(item.name); setModule("Overview"); setSearch(""); }}
              className={`card p-3 text-start w-100 h-100 border ${role === item.name ? "border-info" : "border-secondary"}`}
              style={{ cursor: "pointer" }}>
              <span className="fw-bold mb-1"><i className={`bi ${item.icon} me-2 text-info`} aria-hidden="true" />{item.name}</span>
              <small className="text-secondary">{item.description}</small>
              <span className="small mt-3 text-info">{role === item.name ? "Currently exploring" : "Explore this role"}</span>
            </button>
          </div>
        ))}
      </div>
      <div className="card border-secondary p-3 p-lg-4">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
          <div><h2 className="h4 fw-bold mb-1">{role} workspace preview</h2><p className="small text-secondary mb-0">Example Campus Organization · A.Y. 2026–2027</p></div>
          <span className="badge bg-secondary">Sample records only</span>
        </div>
        <div className="d-flex flex-wrap gap-2 mb-4" role="group" aria-label="Preview module">
          {modules.map((item) => (
            <button type="button" key={item} aria-pressed={module === item} onClick={() => setModule(item)}
              className={`btn btn-sm ${module === item ? "btn-info" : "btn-outline-secondary"}`}>{item}</button>
          ))}
        </div>
        {module === "Overview" ? (
          <>
            <div className="row g-3 mb-3">
              {[["Students", "4"], ["Collected", "₱250.00"], ["Outstanding", "₱225.00"], ["Clearance rate", "50%"]].map(([label, value]) => (
                <div className="col-6 col-lg-3" key={label}><div className="border border-secondary rounded p-3 h-100"><div className="small text-secondary">{label}</div><div className="h4 fw-bold mt-2 mb-0">{value}</div></div></div>
              ))}
            </div>
            <p className="small text-secondary mb-0">These values illustrate how financial and student summaries appear in CLEAR. They are not live analytics.</p>
          </>
        ) : module === "Students" ? (
          <>
            <label className="form-label small fw-semibold" htmlFor="demo-student-search">Search fictional students</label>
            <input id="demo-student-search" type="search" className="form-control mb-3" placeholder="Name, ID, year or status" value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="table-responsive"><table className="table table-sm align-middle"><thead><tr><th>ID</th><th>Name</th><th>Year</th><th>Clearance</th><th>Balance</th></tr></thead><tbody>{filtered.map((student) => <tr key={student.id}><td>{student.id}</td><td>{student.name}</td><td>{student.year}</td><td>{student.status}</td><td>{student.balance}</td></tr>)}</tbody></table></div>
            {filtered.length === 0 && <p className="small text-secondary">No matching sample students.</p>}
          </>
        ) : (
          <div className="table-responsive"><h3 className="h6 fw-semibold">{sample[module].title}</h3><table className="table table-sm align-middle"><thead><tr>{sample[module].columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{sample[module].rows.map((row) => <tr key={row[0]}>{row.map((cell, index) => <td key={index}>{cell}</td>)}</tr>)}</tbody></table></div>
        )}
        <div className="border-top border-secondary mt-3 pt-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <span className="small text-secondary">Want to test the full workflow? Register a separate organization.</span>
          <Link href="/register/organization" className="btn btn-outline-info btn-sm">Register your organization</Link>
        </div>
      </div>
    </main>
  );
}
