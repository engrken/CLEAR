"use client";
import { manilaDateInput } from '@/lib/clear-timezone';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordHistoricalArrearPayment } from "./actions";
import { ThemedAlert } from "@/lib/clear-dialogs";
import type { HistoricalDebt } from "@/lib/student-arrears";

export default function ArrearsPaymentClient({ department, ay, term, studentId, debts }:
  { department: string; ay: string; term: string; studentId: string; debts: HistoricalDebt[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState(debts[0]?.obligationId || "");
  const [orNumber, setOrNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(manilaDateInput());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const item = debts.find(d => d.obligationId === selected);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || !item) return;
    setBusy(true); setMessage("");
    try {
      const result = await recordHistoricalArrearPayment(department, {
        studentId, obligationType: item.obligationType, obligationId: item.obligationId,
        orNumber, amount: Number(amount), paymentDate: date, ay, term,
      });
      // Confirm the posted OR before returning to a blank student lookup.
      // The old student ID must not remain selected for the next payment.
      setOrNumber("");
      setAmount("");
      await ThemedAlert.fire({
        icon: "success", title: "Historical Payment Recorded",
        text: `Receipt ${result.receipt} saved. Remaining historical balance: ₱${result.remaining.toFixed(2)}.`,
      });
      const params = new URLSearchParams({ ay, term });
      router.replace(`/department/${encodeURIComponent(department)}/collections/arrears?${params.toString()}`);
      router.refresh();
    } catch (err) { setMessage(err instanceof Error ? err.message : "Payment failed."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="card bg-body text-body border-secondary p-3 mt-3">
    <h6 className="fw-bold text-info">Receive Payment for Previous-Period Arrears</h6>
    <p className="small text-muted">Current period receipt: {term} ({ay}). The original debt stays linked to its original accounting period.</p>
    <label className="form-label">Outstanding obligation</label>
    <select className="form-select mb-3" value={selected} onChange={e => {setSelected(e.target.value);setAmount("");}} required>
      {debts.map(d => <option key={d.obligationId} value={d.obligationId}>{d.originAY} / {d.originTerm} — {d.category}: {d.itemDescription} — ₱{d.balanceDue.toFixed(2)}</option>)}
    </select>
    <div className="row g-2">
      <div className="col-md-4"><label className="form-label">New OR Number</label><input className="form-control" value={orNumber} onChange={e => setOrNumber(e.target.value)} required maxLength={50} placeholder="Enter unused OR" /></div>
      <div className="col-md-4"><label className="form-label">Amount (₱)</label><input className="form-control" type="number" min="0.01" max={item?.balanceDue} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required /></div>
      <div className="col-md-4"><label className="form-label">Receipt Date</label><input className="form-control" type="date" value={date} onChange={e => setDate(e.target.value)} required /></div>
    </div>
    <button type="submit" className="btn btn-info text-dark fw-bold mt-3" disabled={!item || busy}>{busy ? "Posting..." : "Post Historical Payment & Link Receipt"}</button>
    {message && <div className="alert alert-info mt-3 mb-0" role="status">{message}</div>}
  </form>;
}
