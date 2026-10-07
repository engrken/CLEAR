"use client";

import { useState, useMemo } from "react";
import { fmt } from "@/lib/utils";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

interface ReportsClientProps {
  department: string;
  ay: string;
  term: string;
  students?: any[];
  collections?: any[];
  liquidations?: any[];
  penalties?: any[];
  packageRate: number;
  setupCategories: string[];
}

interface ReportRow {
  id: string;
  studentId: string;
  fullName: string;
  yearLevel: string;
  assessedAmount: number;
  amountPaid: number;
  balanceDue: number;
  status: string;
  particulars: string;
  duration: string;
}

function formatHoursAndMinutes(decimalHours: number) {
  const dec = Number(decimalHours) || 0;
  if (dec <= 0) return "0 hrs";
  const totalMins = Math.round(dec * 60);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0 && mins > 0) return `${hrs} hr${hrs > 1 ? "s" : ""} ${mins} min${mins > 1 ? "s" : ""}`;
  if (hrs > 0) return `${hrs} hr${hrs > 1 ? "s" : ""}`;
  return `${mins} min${mins > 1 ? "s" : ""}`;
}

export default function ReportsClient({
  department,
  ay,
  term,
  students = [],
  collections = [],
  liquidations = [],
  penalties = [],
  packageRate,
  setupCategories
}: ReportsClientProps) {
  const [reportCategory, setReportCategory] = useState("Activity & Item Dues (Unpaid)");
  const [statusFilter, setStatusFilter] = useState("All Students (Master Roster)");
  const [yearFilter, setYearFilter] = useState("All Year Levels");
  const [viewMode, setViewMode] = useState<"Table" | "Analytics">("Table");

  const validCollections = collections.filter(c => !String(c.paymentType || "").toUpperCase().includes("VOID"));
  const validLiquidations = liquidations.filter(l => !String(l.status || "").includes("Voided"));

  // Find any miscellaneous fees recorded in collections that aren't explicitly in the setup
  const dynamicCategories = Array.from(
    new Set(validCollections.map(c => c.category).filter(cat => cat && cat !== "Departmental Fee" && cat !== "Departmental Fee - Package"))
  );
  
  // Base system categories that should always be available
  const systemCategories = [
    "Departmental Fee (Package)",
    "Activity & Item Dues (Unpaid)",
    "Penalty Fee",
    "Liquidation / Audited Expenses"
  ];

  // Merge System + Dynamic Setup Fees + Any stray recorded fees
  const allCategories = Array.from(new Set([...systemCategories, ...setupCategories, ...dynamicCategories]));

  const computedRoster = useMemo(() => {
    if (reportCategory === "Liquidation / Audited Expenses") return [];

    let results: ReportRow[] = [];

    const getStudentData = (sId: string, sName: string) => {
      const s = students.find(st => 
        (sId && st.studentId?.toLowerCase() === sId.toLowerCase()) || 
        (sName && st.fullName?.toLowerCase() === sName.toLowerCase())
      );
      const uniqueKey = (s?.fullName || sName || s?.studentId || sId || "unknown").trim().toLowerCase();
      
      return {
        key: uniqueKey,
        id: s?.id || uniqueKey,
        studentId: s?.studentId || sId || "N/A",
        fullName: s?.fullName || sName || "Unknown",
        yearLevel: s?.yearLevel || "Unassigned"
      };
    };

    if (reportCategory === "Departmental Fee (Package)") {
      const uniformRate = packageRate; 
      results = students.map(student => {
        const studentPayments = validCollections.filter(c => 
          (c.studentId?.toLowerCase() === student.studentId?.toLowerCase() || c.studentName?.toLowerCase() === student.fullName?.toLowerCase()) &&
          (c.category === "Departmental Fee" || c.category === "Departmental Fee - Package" || c.itemDescription?.includes("Package"))
        );
        
        let amountPaid = 0;
        let orNumbers: string[] = [];
        
        studentPayments.forEach(c => {
          amountPaid += Number(c.amountPaid);
          if (c.orNumber && !orNumbers.includes(c.orNumber)) orNumbers.push(c.orNumber);
        });
        
        const balanceDue = Math.max(0, uniformRate - amountPaid);
        let status = "Unpaid";
        if (amountPaid > 0 && amountPaid >= uniformRate) status = "Fully Paid";
        else if (amountPaid > 0 && amountPaid < uniformRate) status = "Partially Paid";

        return {
          id: student.id, studentId: student.studentId, fullName: student.fullName, yearLevel: student.yearLevel || "Unassigned",
          assessedAmount: uniformRate, amountPaid, balanceDue, status, particulars: orNumbers.length > 0 ? orNumbers.join(", ") : "—", duration: ""
        };
      });

    } else if (reportCategory === "Activity & Item Dues (Unpaid)") {
      const payers = new Map();
      validCollections.forEach(c => {
        const pType = String(c.paymentType || "");
        const orNum = String(c.orNumber || "").toUpperCase();
        const balDue = Number(c.balanceDue) || 0;
        const isPackageItem = c.category === "Departmental Fee" || String(c.itemDescription).includes("Package");
        
        // Exclude mandatory package items so standalone dues display cleanly
        if ((pType.includes("Unpaid") || orNum.startsWith("DUE-") || balDue > 0) && !isPackageItem) {
          const sInfo = getStudentData(c.studentId, c.studentName);
          if (!payers.has(sInfo.key)) {
            payers.set(sInfo.key, { ...sInfo, assessedAmount: 0, amountPaid: 0, balanceDue: 0, items: [] });
          }
          const p = payers.get(sInfo.key);
          p.assessedAmount += (Number(c.standardRate) || 0);
          p.amountPaid += (Number(c.amountPaid) || 0);
          p.balanceDue += balDue;
          p.items.push(`${c.itemDescription} [${orNum}]: ₱${balDue.toFixed(2)}`);
        }
      });
      
      results = Array.from(payers.values()).map(p => ({
        ...p, status: p.balanceDue <= 0 ? "Fully Paid" : "Partially Paid", particulars: p.items.join(" ; "), duration: ""
      }));

    } else if (reportCategory === "Penalty Fee") {
      const penMap = new Map();
      penalties.forEach(p => {
        const status = String(p.status || "");
        if (status.includes("Voided")) return;
        
        const sInfo = getStudentData(p.studentId, p.studentName);
        if (!penMap.has(sInfo.key)) {
          penMap.set(sInfo.key, { ...sInfo, totalFine: 0, amountPaid: 0, serviceFine: 0, totalHours: 0, activities: [] });
        }
        
        const pt = penMap.get(sInfo.key);
        const fine = Number(p.fineAmount || p.fine || 0);
        const hrs = Number(p.hoursLate || p.hours || 0);
        pt.totalFine += fine;
        pt.totalHours += hrs; 
        
        let actLabel = `${p.activity} [${formatHoursAndMinutes(hrs)}]`;
        if (status.includes("Community Service")) { pt.serviceFine += fine; actLabel += " (Service)"; }
        pt.activities.push(actLabel);
      });
      
      validCollections.forEach(c => {
        if (c.itemDescription === "Penalty / Fines" || String(c.category).includes("Penalty")) {
          const sInfo = getStudentData(c.studentId, c.studentName);
          if (penMap.has(sInfo.key)) penMap.get(sInfo.key).amountPaid += (Number(c.amountPaid) || 0);
        }
      });

      results = Array.from(penMap.values()).map(p => {
        const totalResolved = p.amountPaid + p.serviceFine;
        const isFullyPaid = totalResolved >= p.totalFine;
        let status = "Partially Paid";
        if (isFullyPaid) status = (p.serviceFine > 0 && p.amountPaid === 0) ? "Settled (Service)" : "Fully Paid";
        return {
          ...p, assessedAmount: p.totalFine, balanceDue: isFullyPaid ? 0 : Math.max(0, p.totalFine - totalResolved),
          duration: formatHoursAndMinutes(p.totalHours), status, particulars: p.activities.join(" ; ")
        };
      });

    } else {
            // Dynamic setup categories
      const itemPayers = new Map();
      validCollections.forEach(c => {
        if (c.itemDescription === reportCategory || c.category === reportCategory) {
          const sInfo = getStudentData(c.studentId, c.studentName);
          if (!itemPayers.has(sInfo.key)) {
            itemPayers.set(sInfo.key, { ...sInfo, rate: Number(c.standardRate)||0, amountPaid: 0, balanceDue: 0, orNumbers: [] });
          }
          const ip = itemPayers.get(sInfo.key);
          ip.amountPaid += (Number(c.amountPaid) || 0);
          ip.balanceDue += (Number(c.balanceDue) || 0);
          if (c.orNumber && !ip.orNumbers.includes(c.orNumber)) ip.orNumbers.push(c.orNumber);
        }
      });
      results = Array.from(itemPayers.values()).map(ip => {
        const netBal = ip.rate > 0 ? Math.max(0, ip.rate - ip.amountPaid) : 0;
        return {
          ...ip, assessedAmount: ip.rate, balanceDue: netBal,
          status: (netBal <= 0 && (ip.rate === 0 || ip.amountPaid >= ip.rate)) ? "Fully Paid" : "Partially Paid", particulars: ip.orNumbers.join(", "), duration: ""
        };
      });
    }

    return results.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [students, validCollections, penalties, reportCategory, term, packageRate]);

  const filteredRoster = computedRoster.filter(row => {
    if (statusFilter === "Fully Paid Only" && row.status !== "Fully Paid" && row.status !== "Settled (Service)") return false;
    if (statusFilter === "Partially Paid Only" && row.status !== "Partially Paid") return false;
    if (statusFilter === "Unpaid Only" && row.status !== "Unpaid") return false;
    if (yearFilter !== "All Year Levels" && row.yearLevel !== yearFilter) return false;
    return true; 
  });

  const groupedRoster = filteredRoster.reduce((acc, row) => {
    const yr = row.yearLevel || "Unassigned";
    if (!acc[yr]) acc[yr] = [];
    acc[yr].push(row);
    return acc;
  }, {} as Record<string, ReportRow[]>);

  const sortedYearLevels = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Unassigned"].filter(y => groupedRoster[y]);

  const fullyPaidCount = filteredRoster.filter(r => r.status === "Fully Paid" || r.status === "Settled (Service)").length;
  const partialCount = filteredRoster.filter(r => r.status === "Partially Paid").length;
  const unpaidCount = filteredRoster.filter(r => r.status === "Unpaid").length;

  const isPenaltyReport = reportCategory === "Penalty Fee";
  const isLiquidationReport = reportCategory === "Liquidation / Audited Expenses";

  // --- CSV EXPORT LOGIC ---
  const handleExportCsv = () => {
    let csv = "";
    
    if (isLiquidationReport) {
      if (validLiquidations.length === 0) return alert("No liquidation records to export.");
      csv = `Date,Audit ID,CA Reference,Officer / Requestor,Fund Source,Budget (CA),Liquidated Exp.,Cash Return (Surplus),Reimburse Due\n`;
      validLiquidations.forEach(l => {
        const budget = (Number(l.totalExpense)||0) + (Number(l.varianceReturn)||0) - (Number(l.reimbursementDue)||0);
        const rawDate = l.date ? String(l.date).split('T')[0] : '—';
        csv += `"${rawDate}","${l.auditId}","${l.referenceCaId || l.advanceId || ''}","${l.requestor}","${l.fundSource}",${budget},${l.totalExpense},${l.varianceReturn||0},${l.reimbursementDue||0}\n`;
      });
    } else if (isPenaltyReport) {
      if (sortedYearLevels.length === 0) return alert("No penalty records to export.");
      csv = `Year Level,Student ID,Student Name,Duration,Assessed Fee,Amount Paid,Balance Due,Status,Particulars\n`;
      sortedYearLevels.forEach(yr => {
        groupedRoster[yr].forEach(s => {
          csv += `"${yr}","${s.studentId}","${s.fullName}","${s.duration}",${s.assessedAmount},${s.amountPaid},${s.balanceDue},"${s.status}","${s.particulars}"\n`;
        });
      });
    } else {
      if (sortedYearLevels.length === 0) return alert("No records to export for this category.");
      csv = `Year Level,Student ID,Student Name,Assessed Fee,Amount Paid,Balance Due,Status,OR Number(s)\n`;
      sortedYearLevels.forEach(yr => {
        groupedRoster[yr].forEach(s => {
          csv += `"${yr}","${s.studentId}","${s.fullName}",${s.assessedAmount},${s.amountPaid},${s.balanceDue},"${s.status}","${s.particulars}"\n`;
        });
      });
    }
    
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `CLEAR_${reportCategory.replace(/[^a-zA-Z0-9]/g, '_')}_${ay}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- ANALYTICS CHARTS SETUP ---
  const pieData = {
    labels: ['Fully Paid / Cleared', 'Partially Paid', 'Unpaid / Deficit'],
    datasets: [{
      data: [fullyPaidCount, partialCount, unpaidCount],
      backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
      borderWidth: 1,
      borderColor: '#1e293b'
    }]
  };

  const barData = {
    labels: sortedYearLevels,
    datasets: [{
      label: 'Total Collections (₱)',
      data: sortedYearLevels.map(yr => groupedRoster[yr].reduce((sum, s) => sum + s.amountPaid, 0)),
      backgroundColor: '#38bdf8',
      borderRadius: 4
    }]
  };

  const chartOptionsBase = {
    responsive: true,
    maintainAspectRatio: false,
    color: '#94a3b8'
  };

  return (
    <div>
      {/* Header Toolbar */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h5 className="text-info fw-bold mb-0">
            <i className="bi bi-bar-chart-fill me-2"></i>Institutional Collections & Liquidation Reports
          </h5>
        </div>
        <div className="btn-group btn-group-sm border border-secondary rounded">
          <button className={`btn ${viewMode === 'Table' ? 'btn-info text-dark fw-bold' : 'btn-outline-secondary'}`} onClick={() => setViewMode('Table')}>
            <i className="bi bi-table me-1"></i> Table View
          </button>
          <button className={`btn ${viewMode === 'Analytics' ? 'btn-info text-dark fw-bold' : 'btn-outline-secondary'}`} onClick={() => setViewMode('Analytics')}>
            <i className="bi bi-pie-chart me-1"></i> Analytics Charts
          </button>
          <button className="btn btn-outline-secondary" onClick={handleExportCsv}>
            <i className="bi bi-filetype-csv me-1"></i> Export CSV
          </button>
        </div>
      </div>

      {/* Filters Area */}
      <div className="row g-3 mb-3">
        <div className="col-12 col-md-4">
          <label className="form-label text-secondary small mb-1">Report Category</label>
          <select className="form-select bg-card text-white border-secondary" value={reportCategory} onChange={e => setReportCategory(e.target.value)}>
            {allCategories.map((cat, idx) => <option key={idx} value={cat}>{cat}</option>)}
          </select>
        </div>
        {!isLiquidationReport && (
          <>
            <div className="col-12 col-md-3">
              <label className="form-label text-secondary small mb-1">Year Level Filter</label>
              <select className="form-select bg-card text-white border-secondary" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                <option value="All Year Levels">All Year Levels</option>
                <option value="1st Year">1st Year</option>
                <option value="2nd Year">2nd Year</option>
                <option value="3rd Year">3rd Year</option>
                <option value="4th Year">4th Year</option>
              </select>
            </div>
            <div className="col-12 col-md-3">
              <label className="form-label text-secondary small mb-1">Payment Status Filter</label>
              <select className="form-select bg-card text-white border-secondary" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} disabled={isPenaltyReport}>
                <option value="All Students (Master Roster)">All Students (Master Roster)</option>
                <option value="Fully Paid Only">Fully Paid Only</option>
                <option value="Partially Paid Only">Partially Paid Only</option>
                <option value="Unpaid Only">Unpaid Only</option>
              </select>
            </div>
          </>
        )}
        <div className="col-12 col-md-2 d-flex align-items-end ms-auto">
          <button className="btn btn-outline-info w-100" onClick={() => window.location.reload()}>
            <i className="bi bi-arrow-clockwise me-1"></i> Refresh
          </button>
        </div>
      </div>

      {!isLiquidationReport && (
        <div className="bg-dark border border-secondary rounded p-2 mb-3 shadow-sm d-flex gap-3 px-3">
          <span className="text-secondary fw-bold small">{ay} ({term}) — {reportCategory}: {filteredRoster.length} student(s) displayed</span>
          <span className="text-secondary">|</span>
          <span className="text-success fw-bold small">{fullyPaidCount} Fully Paid / Cleared</span>
          <span className="text-secondary">|</span>
          <span className="text-warning fw-bold small">{partialCount} Partially Paid</span>
          {unpaidCount > 0 && (
            <>
              <span className="text-secondary">|</span>
              <span className="text-danger fw-bold small">{unpaidCount} Unpaid</span>
            </>
          )}
        </div>
      )}

      {/* --- ANALYTICS VIEW --- */}
      {viewMode === "Analytics" && !isLiquidationReport && (
        <div className="row g-3 mb-4">
          <div className="col-12 col-md-6">
            <div className="card p-3 border-secondary bg-card shadow-sm h-100">
              <h6 className="text-accent fw-bold mb-3">Collection Status Breakdown</h6>
              <div style={{ position: 'relative', height: '280px' }}>
                <Doughnut 
                  data={pieData} 
                  options={{ ...chartOptionsBase, plugins: { legend: { position: 'bottom', labels: { color: '#f8fafc' } } } }} 
                />
              </div>
            </div>
          </div>
          <div className="col-12 col-md-6">
            <div className="card p-3 border-secondary bg-card shadow-sm h-100">
              <h6 className="text-accent fw-bold mb-3">Collections by Year Level</h6>
              <div style={{ position: 'relative', height: '280px' }}>
                <Bar 
                  data={barData} 
                  options={{ 
                    ...chartOptionsBase, 
                    plugins: { legend: { display: false } },
                    scales: { 
                      x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }, 
                      y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } } 
                    } 
                  }} 
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === "Analytics" && isLiquidationReport && (
        <div className="text-center text-secondary py-5">
          <i className="bi bi-bar-chart-line fs-1 d-block mb-2 text-secondary opacity-50"></i>
          Analytics charts are available for student collections, fees, and penalties.
        </div>
      )}

      {/* --- TABLE VIEW (ROSTER) --- */}
      {!isLiquidationReport && viewMode === "Table" && (
        <div className="report-groups-container">
          {sortedYearLevels.length === 0 ? (
            <div className="text-center text-secondary py-4">No records found for the selected filters.</div>
          ) : (
            sortedYearLevels.map(yr => (
              <div key={yr} className="mb-4">
                <div className="badge bg-primary fs-6 mb-2 px-3 py-2 w-100 text-start">{yr} ({groupedRoster[yr].length} Students)</div>
                <div className="table-responsive">
                  <table className="table table-hover align-middle table-sm border-secondary text-white">
                    <thead>
                      <tr className="text-secondary border-bottom border-secondary" style={{ fontSize: '0.85rem' }}>
                        <th className="py-2">Student ID</th>
                        <th className="py-2">Student Name</th>
                        {isPenaltyReport && <th className="py-2">Total Duration</th>}
                        <th className="py-2 text-end">Assessed Fee</th>
                        <th className="py-2 text-end">Amount Paid</th>
                        <th className="py-2 text-end">Balance Due</th>
                        <th className="py-2">Payment Status</th>
                        <th className="py-2">{isPenaltyReport ? 'Activities & Breakdown' : 'OR Number(s)'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedRoster[yr].map((row, idx) => (
                        <tr key={`${row.id}-${idx}`}>
                          <td><span className="text-info font-monospace">{row.studentId}</span></td>
                          <td className="fw-semibold">{row.fullName}</td>
                          {isPenaltyReport && <td className="fw-semibold text-info">{row.duration}</td>}
                          <td className="text-end">{fmt(row.assessedAmount)}</td>
                          <td className="fw-bold text-info text-end">{fmt(row.amountPaid)}</td>
                          <td className={`text-end ${row.balanceDue > 0 ? 'text-danger fw-bold' : 'text-secondary'}`}>{fmt(row.balanceDue)}</td>
                          <td>
                            <span className={`badge ${row.status === 'Fully Paid' || row.status === 'Settled (Service)' ? 'bg-success' : row.status === 'Partially Paid' ? 'bg-warning text-dark' : 'bg-danger'}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="text-secondary small" style={{ maxWidth: '300px' }}>{row.particulars}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* --- TABLE VIEW (LIQUIDATIONS) --- */}
      {isLiquidationReport && viewMode === "Table" && (
        <div>
          <div className="bg-dark border border-secondary rounded p-2 mb-3 shadow-sm px-3">
            <span className="text-secondary fw-bold small">{ay} ({term}) — Liquidation Audits: {validLiquidations.length} records found</span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle table-sm border-secondary text-white">
              <thead>
                <tr className="text-secondary border-bottom border-secondary" style={{ fontSize: '0.85rem' }}>
                  <th className="py-2">Date</th>
                  <th className="py-2">Audit ID</th>
                  <th className="py-2">CA Reference</th>
                  <th className="py-2">Officer / Requestor</th>
                  <th className="py-2">Fund Source</th>
                  <th className="py-2 text-end">Budget (CA)</th>
                  <th className="py-2 text-end">Liquidated Exp.</th>
                  <th className="py-2 text-end">Variance / Result</th>
                </tr>
              </thead>
              <tbody>
                {validLiquidations.length === 0 ? (
                  <tr><td colSpan={8} className="text-center text-secondary py-4">No audited liquidation records found.</td></tr>
                ) : (
                  validLiquidations.map((l, idx) => {
                    const budget = (Number(l.totalExpense)||0) + (Number(l.varianceReturn)||0) - (Number(l.reimbursementDue)||0);
                    let resultBadge = <span className="badge bg-secondary">Exact (₱0.00)</span>;
                    if (Number(l.varianceReturn) > 0) resultBadge = <span className="badge bg-success">+{fmt(l.varianceReturn)} (Return)</span>;
                    else if (Number(l.reimbursementDue) > 0) resultBadge = <span className="badge bg-danger">-{fmt(l.reimbursementDue)} (Reimburse)</span>;

                    return (
                      <tr key={`${l.id}-${idx}`}>
                        <td className="text-secondary small">{l.date ? String(l.date).split('T')[0] : '—'}</td>
                        <td><strong>{l.auditId}</strong></td>
                        <td><span className="text-accent">{l.referenceCaId || l.advanceId || '—'}</span></td>
                        <td>{l.requestor || '—'}</td>
                        <td>{l.fundSource}</td>
                        <td className="text-end">{fmt(budget)}</td>
                        <td className="text-end text-danger fw-bold">{fmt(l.totalExpense)}</td>
                        <td className="text-end">{resultBadge}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
                          }
