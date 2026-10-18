"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  configurationForYear, periodsFor, type CalendarByYear, type CalendarMode,
} from "@/lib/academic-periods";
import { saveAcademicPeriodConfig } from "./academic-period-actions";

export default function AcademicPeriodSettings({ department, activeAy, initialConfigs }: {
  department: string;
  activeAy: string;
  initialConfigs: CalendarByYear;
}) {
  const router = useRouter();
  const [year, setYear] = useState(activeAy);
  const current = useMemo(() => configurationForYear(year, initialConfigs), [year, initialConfigs]);
  const [mode, setMode] = useState<CalendarMode>(current.mode);
  const [summer, setSummer] = useState(current.includeSummer);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => { setMode(current.mode); setSummer(current.includeSummer); setMessage(null); }, [current]);
  const startYear = Number(activeAy.match(/\d{4}/)?.[0] || new Date().getFullYear());
  const years = [...new Set([activeAy, ...Object.keys(initialConfigs), ...Array.from({length: 7}, (_, i) => `A.Y. ${startYear - 1 + i} - ${startYear + i}`)])].sort();
  const options = periodsFor({ mode, includeSummer: summer });

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    start(async () => {
      try {
        await saveAcademicPeriodConfig(department, year, mode, summer);
        setMessage({ ok: true, text: `${year} now uses ${mode}: ${options.join(", ")}. Reload the page to review the updated period selectors.` });
        router.refresh();
      } catch (e) { setMessage({ ok: false, text: e instanceof Error ? e.message : "Unable to save academic calendar." }); }
    });
  }

  return <div className="card p-3 mb-4 border-secondary bg-body text-body">
    <h6 className="fw-bold text-info"><i className="bi bi-calendar-range me-2" />Academic Calendar by School Year</h6>
    <p className="small text-muted">Choose the accounting periods used by this organization. Historical transactions remain in their original periods. A calendar change is blocked if existing records would become inaccessible.</p>
    <form onSubmit={save} className="row g-3 align-items-end">
      <div className="col-12 col-md-4"><label className="form-label">Academic Year</label>
        <select className="form-select" value={year} onChange={e => setYear(e.target.value)}>{years.map(x => <option key={x} value={x}>{x}</option>)}</select></div>
      <div className="col-12 col-md-4"><label className="form-label">School Calendar</label>
        <select className="form-select" value={mode} onChange={e => setMode(e.target.value as CalendarMode)}>
          <option value="FullYear">Full school year</option><option value="Semester">Semester</option><option value="Trimester">Trimester</option>
        </select></div>
      <div className="col-12 col-md-4"><div className="form-check mb-2">
        <input className="form-check-input" type="checkbox" id="include-summer" checked={mode === "Semester" && summer} disabled={mode !== "Semester"} onChange={e => setSummer(e.target.checked)} />
        <label className="form-check-label" htmlFor="include-summer">Include Summer term</label></div>
        <button className="btn btn-info fw-bold w-100" type="submit" disabled={pending}>{pending ? "Saving..." : "Save Calendar"}</button></div>
    </form>
    <div className="small text-muted mt-3">Available periods: <strong>{options.join(" · ")}</strong></div>
    {message && <div role="alert" className={`alert mt-3 mb-0 ${message.ok ? "alert-success" : "alert-danger"}`}>{message.text}</div>}
  </div>;
}
