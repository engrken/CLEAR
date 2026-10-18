"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearAlert, clearConfirm, clearPrompt } from "@/lib/clear-dialogs";
import { executeVoidTransaction } from "../void/actions";

type Advance = {
  id: string; advanceId: string; dateIssued: string; requestor: string;
  fundSource: string; amountApproved: number; purpose: string | null;
  expectedReturnDate: string | null; status: string;
};
export default function CashAdvanceHistory({ department, ay, term, advances, canVoid, closed }: {
  department: string; ay: string; term: string; advances: Advance[]; canVoid: boolean; closed: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<string | null>(null);
  const rows = useMemo(() => advances.filter(a => {
    const status = a.status.toUpperCase();
    const matches = filter === "All" ||
      (filter === "Open" && (status.includes("PENDING") || status.includes("UNLIQUIDATED"))) ||
      (filter === "Liquidated" && status === "LIQUIDATED") ||
      (filter === "Voided" && /VOID|CANCEL/.test(status));
    return matches && [a.advanceId, a.requestor, a.fundSource, a.purpose || ""].join(" ")
      .toLowerCase().includes(search.trim().toLowerCase());
  }), [advances, search, filter]);
  const visible = rows.slice((page - 1) * 10, page * 10);
  const pages = Math.max(1, Math.ceil(rows.length / 10));
  const cancelAdvance = async (a: Advance) => {
    if (closed || !canVoid || pending) return;
    const reason = await clearPrompt(`Enter the reason for voiding ${a.advanceId}. This will release its unused reservation.`,
      { title: "Void Cash Advance", multiline: true, confirmText: "Continue" });
    if (reason === null) return;
    if (reason.trim().length < 5) return void clearAlert("A reason of at least 5 characters is required.");
    if (!await clearConfirm(`Void ${a.advanceId}? Any active liquidation must be reversed first.`,
      { title: "Confirm Advance Reversal", confirmText: "Void Advance" })) return;
    setPending(a.id);
    try {
      await executeVoidTransaction({ department, category: "advances", referenceId: a.advanceId,
        ay, term, reason: reason.trim() });
      await clearAlert("Cash advance voided and reservation released. Audit history retained.", "success");
      setSearch("");
      setPage(1);
      router.refresh();
    } catch (e: any) { await clearAlert(e?.message || "Cash advance reversal failed.", "error"); }
    finally { setPending(null); }
  };
  return <section className="border-top mt-4 pt-3">
    <h6 className="fw-bold text-info">Cash Advance History</h6>
    <p className="small text-body-secondary">All issued advances are retained, including canceled and liquidated records.</p>
    <div className="d-flex gap-2 flex-wrap mb-3">
      <input className="form-control form-control-sm bg-body text-body" style={{maxWidth:340}}
        aria-label="Search cash advances" placeholder="Search reference, requestor, purpose, or fund"
        value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} />
      <select className="form-select form-select-sm bg-body text-body" style={{maxWidth:170}}
        aria-label="Filter advance status" value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}}>
        {["All","Open","Liquidated","Voided"].map(s=><option key={s}>{s}</option>)}
      </select>
    </div>
    <div className="table-responsive"><table className="table table-sm align-middle">
      <thead><tr><th>Advance ID / Date</th><th>Requestor / Purpose</th><th>Fund</th><th className="text-end">Amount</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>{visible.map(a => <tr key={a.id}>
        <td className="text-nowrap"><strong>{a.advanceId}</strong><div className="small text-body-secondary">{new Date(a.dateIssued).toLocaleDateString()}</div></td>
        <td>{a.requestor}<div className="small text-body-secondary">{a.purpose || "—"}</div></td>
        <td>{a.fundSource}</td><td className="text-end">₱{Number(a.amountApproved).toFixed(2)}</td>
        <td><span className="badge text-bg-secondary">{a.status}</span></td>
        <td>{canVoid && !closed && !/VOID|CANCEL|LIQUIDATED/i.test(a.status)
          ? <button type="button" className="btn btn-sm btn-outline-danger" disabled={!!pending}
              onClick={()=>cancelAdvance(a)}>{pending===a.id?"Voiding...":"Void"}</button>
          : <span className="text-body-secondary small">—</span>}</td>
      </tr>)}{!visible.length&&<tr><td colSpan={6} className="text-center text-body-secondary">No advances found.</td></tr>}</tbody>
    </table></div>
    <div className="d-flex align-items-center justify-content-between mt-2">
      <small>{rows.length} record(s) • Page {Math.min(page,pages)} of {pages}</small>
      <div className="d-flex gap-1"><button className="btn btn-outline-secondary btn-sm" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Previous</button>
        <button className="btn btn-outline-secondary btn-sm" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Next</button></div>
    </div>
  </section>;
}
