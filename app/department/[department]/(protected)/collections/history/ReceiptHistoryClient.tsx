"use client";
import { formatManilaDate } from '@/lib/clear-timezone';

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearAlert, clearConfirm } from "@/lib/clear-dialogs";
import { resendCollectionsReceipt } from "./actions";

type Receipt = { orNumber: string; studentName: string; studentNumber: string;
  date: string; timestamp: string; academicYear: string; term: string;
  encodedBy: string; status: string; inconsistencyReason: string; total: number;
  count: number; description: string; key: string };
type Props = {
  department: string; receipts: Receipt[]; ay: string; term: string;
  q: string; exactOr: string; statusFilter: string; category: string;
  description: string; paymentType: string; from: string; to: string;
  inconsistentOnly: boolean; categories: string[]; paymentTypes: string[];
  page: number; pageSize: number; total: number; maxPage: number;
};
const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ReceiptHistoryClient(p: Props) {
  const router = useRouter();
  const [search, setSearch] = useState(p.q);
  const [exactOrSearch, setExactOrSearch] = useState(p.exactOr);
  const [descriptionSearch, setDescriptionSearch] = useState(p.description);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editingSearch = useRef(false);
  const clearScheduledSearch = () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = null;
  };
  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  }, []);
  useEffect(() => {
    if (!editingSearch.current) {
      setSearch(p.q);
      setExactOrSearch(p.exactOr);
      setDescriptionSearch(p.description);
    } else if (!searchTimer.current && search.trim() === p.q.trim()
      && exactOrSearch.trim() === p.exactOr.trim()
      && descriptionSearch.trim() === p.description.trim()) {
      editingSearch.current = false;
    }
  }, [p.q, p.exactOr, p.description, search, exactOrSearch, descriptionSearch]);
  const [busy, begin] = useTransition();
  const [isNavigating, startNavigation] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const [toStudent, setToStudent] = useState(true);
  const [toOfficer, setToOfficer] = useState(true);
  const historyBase = `/department/${encodeURIComponent(p.department)}/collections/history`;
  const navigate = (changes: Record<string, string>, replace = false) => {
    clearScheduledSearch();
    const drafts = editingSearch.current
      ? { q: search.trim(), or: exactOrSearch.trim(), description: descriptionSearch.trim() }
      : {};
    const qs = new URLSearchParams({
      ay: p.ay || "all", term: p.term || "all", q: p.q,
      or: p.exactOr, status: p.statusFilter, category: p.category,
      description: p.description, paymentType: p.paymentType,
      from: p.from, to: p.to, inconsistentOnly: p.inconsistentOnly ? "1" : "0",
      page: String(p.page), size: String(p.pageSize), ...drafts, ...changes,
    });
    startNavigation(() => {
      const url = `${historyBase}?${qs.toString()}`;
      if (replace) router.replace(url, { scroll: false });
      else router.push(url);
    });
  };
  const scheduleSearch = (next: { q: string; or: string; description: string }) => {
    editingSearch.current = true;
    clearScheduledSearch();
    searchTimer.current = setTimeout(() => {
      searchTimer.current = null;
      navigate({
        q: next.q.trim(),
        or: next.or.trim(),
        description: next.description.trim(),
        page: "1",
      }, true);
    }, 450);
  };
  const sendCopy = async () => {
    if (!selected) return;
    const orNumber = selected;
    if (!toStudent && !toOfficer) {
      await clearAlert("Select the student and/or yourself as recipient.", "warning"); return;
    }
    if (!await clearConfirm(`Queue another electronic copy of existing OR ${orNumber}? The receipt number and payment will not change.`,
      { title: "Resend Existing Receipt", confirmText: "Queue Email Copy", kind: "question" })) return;
    begin(async () => {
      try {
        const result = await resendCollectionsReceipt(p.department, orNumber,
          { student: toStudent, officer: toOfficer });
        setSelected(null);
        await clearAlert(result.message, result.queued ? "success" : "info");
        router.refresh();
      } catch (err) {
        await clearAlert(err instanceof Error ? err.message : "Failed to queue the receipt email.", "error");
      }
    });
  };
  return (
    <>
      <form className="row g-2 mb-3" onSubmit={(e) => {
        e.preventDefault();
        navigate({ q: search.trim(), or: exactOrSearch.trim(), description: descriptionSearch.trim(), page: "1" });
      }}>
        <div className="col-12 col-md-4">
          <label className="form-label small fw-semibold">Student name / ID / OR search</label>
          <input className="form-control" value={search} onChange={e => {
            setSearch(e.target.value);
            scheduleSearch({ q: e.target.value, or: exactOrSearch, description: descriptionSearch });
          }}
            maxLength={80} placeholder="Student or OR..." aria-label="Search issued receipt history" />
        </div>
        <div className="col-12 col-md-2">
          <label className="form-label small fw-semibold">Exact OR number</label>
          <input className="form-control" value={exactOrSearch} onChange={e => {
            setExactOrSearch(e.target.value);
            scheduleSearch({ q: search, or: e.target.value, description: descriptionSearch });
          }}
            maxLength={50} placeholder="26-376" aria-label="Exact official receipt number" />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-semibold">Status</label>
          <select className="form-select" value={p.statusFilter} onChange={e =>
            navigate({ status: e.target.value, inconsistentOnly: "0", page: "1" })}>
            <option value="all">All</option>
            <option value="valid">Valid</option>
            <option value="voided">Voided</option>
            <option value="inconsistent">Inconsistent</option>
          </select>
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-semibold">Rows per page</label>
          <select className="form-select" value={p.pageSize} onChange={e =>
            navigate({ size: e.target.value, page: "1" })}>
            {[10,25,50,100].map(n => <option value={n} key={n}>{n}</option>)}
          </select>
        </div>
        <div className="col-12 col-md-3">
          <label className="form-label small fw-semibold">Category</label>
          <select className="form-select" value={p.category} onChange={e =>
            navigate({ category: e.target.value, page: "1" })}>
            <option value="">All categories</option>
            {p.categories.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="col-12 col-md-3">
          <label className="form-label small fw-semibold">Payment type</label>
          <select className="form-select" value={p.paymentType} onChange={e =>
            navigate({ paymentType: e.target.value, page: "1" })}>
            <option value="">All payment types</option>
            {p.paymentTypes.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="col-12 col-md-6">
          <label className="form-label small fw-semibold">Item description contains</label>
          <input className="form-control" value={descriptionSearch}
            onChange={e => {
              setDescriptionSearch(e.target.value);
              scheduleSearch({ q: search, or: exactOrSearch, description: e.target.value });
            }} maxLength={120}
            placeholder="Departmental Fee, Penalty, Shirt..." />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-semibold">Receipt date from</label>
          <input type="date" className="form-control" value={p.from}
            onChange={e => navigate({ from: e.target.value, page: "1" })} />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label small fw-semibold">Receipt date to</label>
          <input type="date" className="form-control" value={p.to}
            onChange={e => navigate({ to: e.target.value, page: "1" })} />
        </div>
        <div className="col-12 col-md-3 d-flex align-items-end">
          <label className="form-check mb-2">
            <input className="form-check-input" type="checkbox" checked={p.inconsistentOnly}
              onChange={e => navigate({
                inconsistentOnly: e.target.checked ? "1" : "0",
                status: "all", page: "1",
              })} />
            <span className="form-check-label small">Only inconsistent receipts</span>
          </label>
        </div>
        <div className="col-12 col-md-6 d-flex gap-2 align-items-end">
          <button className="btn btn-primary flex-grow-1" type="submit" disabled={isNavigating}>
            <i className="bi bi-search me-1"/>Search
          </button>
          <button className="btn btn-outline-secondary" type="button" disabled={isNavigating}
            onClick={() => {
              setSearch(""); setExactOrSearch(""); setDescriptionSearch("");
              navigate({ q: "", or: "", category: "", description: "",
                paymentType: "", from: "", to: "", status: "all",
                inconsistentOnly: "0", page: "1" });
            }}>Clear filters</button>
        </div>
      </form>
      <p className="small text-muted mb-2" role="status">
        {isNavigating ? 'Updating matching receipts…' : 'Search fields update automatically while you type.'}
      </p>
      {isNavigating ? (
        <div className="alert alert-info py-2 small" role="status">
          Loading matching receipts — previous results are temporarily hidden.
        </div>
      ) : (
        <div className="d-flex flex-wrap justify-content-between align-items-center mb-2 gap-2">
          <span className="small text-muted">
            Showing {p.total ? (p.page - 1) * p.pageSize + 1 : 0}–{Math.min(p.total, p.page * p.pageSize)}
            {" "}of {p.total} issued receipts
          </span>
          <button className="btn btn-outline-info btn-sm" type="button"
            onClick={() => navigate({ ay: "all", term: "all", page: "1" })}>
            View All Academic Periods
          </button>
        </div>
      )}
      {!isNavigating && <div className="table-responsive">
        <table className="table table-hover table-bordered align-middle small">
          <thead><tr><th>Date</th><th>OR Number</th><th>Student</th><th>Period</th><th>Details</th><th className="text-end">Paid</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {!p.receipts.length && <tr><td colSpan={8} className="text-center text-muted py-4">No matching receipts.</td></tr>}
            {p.receipts.map(row => <tr key={row.key}>
              <td className="text-nowrap">{formatManilaDate(row.date)}</td>
              <td className="fw-semibold">{row.orNumber}</td>
              <td><div>{row.studentName}</div><span className="text-muted">{row.studentNumber}</span></td>
              <td>{row.term}<div className="text-muted">{row.academicYear}</div></td>
              <td style={{ minWidth: "150px", maxWidth: "260px" }}>{row.description || "—"}{row.count > 1 && <small className="text-muted d-block">{row.count} allocation lines</small>}</td>
              <td className="text-end text-nowrap fw-semibold">{peso(row.total)}</td>
              <td>
                <span className={`badge ${row.status === "Valid" ? "bg-success" : row.status === "Voided" ? "bg-secondary" : "bg-warning text-dark"}`}
                  title={row.inconsistencyReason || undefined}>{row.status}</span>
                {row.inconsistencyReason && <div className="small text-warning mt-1">{row.inconsistencyReason}</div>}
              </td>
              <td><div className="d-flex gap-1 flex-wrap">
                <Link className="btn btn-outline-primary btn-sm" href={`${historyBase}/${encodeURIComponent(row.orNumber)}`} title="View and print this receipt" target="_blank" rel="noopener noreferrer"><i className="bi bi-printer me-1"/>Reprint</Link>
                <button className="btn btn-outline-info btn-sm" type="button" disabled={busy || row.status !== "Valid"}
                  onClick={() => { setToStudent(true); setToOfficer(true); setSelected(row.orNumber); }} title="Resend to registered addresses only"><i className="bi bi-envelope me-1"/>Resend</button>
              </div></td>
            </tr>)}
          </tbody>
        </table>
      </div>}
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <small className="text-muted">Page {p.page} of {p.maxPage}</small>
        <div className="btn-group btn-group-sm">
          <button className="btn btn-outline-secondary" disabled={isNavigating || p.page<=1}
            onClick={() => navigate({ page: String(p.page-1) })}>Previous</button>
          <button className="btn btn-outline-secondary" disabled={isNavigating || p.page>=p.maxPage}
            onClick={() => navigate({ page: String(p.page+1) })}>Next</button>
        </div>
      </div>
      {selected && <div className="modal d-block" role="dialog" aria-modal="true" aria-label="Resend receipt options" style={{ background: "rgba(0,0,0,.6)" }}>
        <div className="modal-dialog modal-dialog-centered"><div className="modal-content">
          <div className="modal-header"><h5 className="modal-title">Email receipt {selected}</h5>
            <button type="button" className="btn-close" aria-label="Close" disabled={busy} onClick={() => setSelected(null)}/></div>
          <div className="modal-body">
            <p className="small text-muted">Only registered student and authenticated officer addresses are used. Email preferences apply; this does not issue a new payment.</p>
            <label className="form-check mb-2"><input className="form-check-input" type="checkbox" checked={toStudent} onChange={e => setToStudent(e.target.checked)}/><span className="form-check-label">Student copy</span></label>
            <label className="form-check"><input className="form-check-input" type="checkbox" checked={toOfficer} onChange={e => setToOfficer(e.target.checked)}/><span className="form-check-label">My processing-officer copy</span></label>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={() => setSelected(null)}>Cancel</button>
            <button type="button" className="btn btn-primary" disabled={busy || (!toStudent && !toOfficer)} onClick={sendCopy}>{busy ? "Queuing..." : "Queue Email"}</button></div>
        </div></div>
      </div>}
    </>
  );
}
