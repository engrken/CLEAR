// /(protected)/reports/ReportsClient.tsx

"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveSignatories } from "../../actions";
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
  orgName: string;
  ay: string;
  term: string;
  students?: any[];
  collections?: any[];
  liquidations?: any[];
  penalties?: any[];
  packageRate: number;
  setupCategories: string[];
  termPkgItems: { name: string; rate: number; fund: string }[];
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
  orgName,
  ay,
  term,
  orgId,
  students = [],
  collections = [],
  liquidations = [],
  penalties = [],
  packageRate,
  setupCategories = [],
  logoUrl,
  initialSignatories,
  termPkgItems = []
}: any) {
  const router = useRouter();

  // =========================================================
  // SETTINGS MODAL STATE
  // =========================================================
  const [showSettings, setShowSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [signatories, setSignatories] = useState(initialSignatories || []);
  
  const labelOptions = ["Prepared by:", "Attested by:", "Noted by:", "Endorsed by:", "Verified by:", "Approved by:"];

  const handleAddSignatory = () => {
    setSignatories([...signatories, { label: "Prepared by:", name: "", position: "" }]);
  };

  const handleUpdateSignatory = (index: number, field: string, value: string) => {
    const updated = [...signatories];
    updated[index] = { ...updated[index], [field]: value };
    setSignatories(updated);
  };

  const handleRemoveSignatory = (index: number) => {
    setSignatories(signatories.filter((_: any, i: number) => i !== index));
  };

  const handleSaveSignatories = async () => {
    setIsSaving(true);
    try {
      await saveSignatories(orgId, department, signatories);
      setShowSettings(false);
      router.refresh();
    } catch (error) {
      alert("Failed to save signatories.");
    } finally {
      setIsSaving(false);
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const getAssetUrl = (filename: string) => {
    if (mounted && window.location.hostname.endsWith('.localhost')) {
      return `http://localhost:${window.location.port}/${filename}`;
    }
    return `/${filename}`;
  };

  const validCollections = collections.filter((c: any) => !String(c.paymentType || "").toUpperCase().includes("VOID"));
  const validLiquidations = liquidations.filter((l: any) => !String(l.status || "").includes("Voided"));

  // =========================================================
  // DYNAMIC CATEGORY RESOLUTION
  // =========================================================
  const hasPackageData = termPkgItems.length > 0 || packageRate > 0 || validCollections.some((c: any) => String(c.itemDescription || '').toLowerCase().includes('package') || String(c.itemDescription || '').toLowerCase() === 'departmental fee');
  const hasUnpaidDues = validCollections.some((c: any) => String(c.paymentType || "").includes("Unpaid") || String(c.orNumber || "").toUpperCase().startsWith("DUE-") || Number(c.balanceDue) > 0);

  const dynamicCategories = Array.from(
    new Set([
      ...(setupCategories || []),
      ...(termPkgItems || []).map((i: any) => i.name),
      ...validCollections.map((c: any) => String(c.itemDescription || c.category || '')).filter(Boolean)
    ])
  ).filter((cat: string) => cat !== "Penalty / Fines" && !cat.toLowerCase().includes("penalty"));

  const defaultCategory = hasUnpaidDues ? "Activity & Item Dues (Unpaid)" : (dynamicCategories[0] || "Liquidation / Audited Expenses");

  const [reportCategory, setReportCategory] = useState(defaultCategory);
  const [statusFilter, setStatusFilter] = useState("All Students (Master Roster)");
  const [yearFilter, setYearFilter] = useState("All Year Levels");
  const [viewMode, setViewMode] = useState<"Table" | "Analytics">("Table");

  const computedRoster = useMemo(() => {
    if (reportCategory === "Liquidation / Audited Expenses") return [];

    let results: ReportRow[] = [];

    const matchStudent = (cStudentId: unknown, cStudentName: unknown, student: any) => {
      const cleanRef = String(cStudentId || "").trim().toLowerCase();
      const sUuid = String(student?.id || "").trim().toLowerCase();
      const sNum = String(student?.studentId || "").trim().toLowerCase();
      
      const sName = String(student?.fullName || "").trim().toLowerCase().replace(/\s+/g, " ");
      const cName = String(cStudentName || "").trim().toLowerCase().replace(/\s+/g, " ");

      return (
        (cleanRef && (cleanRef === sUuid || cleanRef === sNum)) ||
        (cName && cName === sName)
      );
    };

    const getStudentData = (sId: string, sName: string) => {
      const s = students.find((st: any) => matchStudent(sId, sName, st));
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
      results = students.map((student: any) => {
        const studentPayments = validCollections.filter((c: any) => {
          const isMatch = matchStudent(c.studentId, c.studentName, student);
          const descLower = String(c.itemDescription || '').toLowerCase();
          const isPackageItem = termPkgItems.some((pi: any) => pi.name.toLowerCase() === descLower) || descLower.includes('package') || descLower === 'departmental fee';
          
          return isMatch && isPackageItem;
        });

        let amountPaid = 0;
        let orNumbers: string[] = [];
        studentPayments.forEach((c: any) => {
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
      validCollections.forEach((c: any) => {
        const pType = String(c.paymentType || "");
        const orNum = String(c.orNumber || "").toUpperCase();
        const balDue = Number(c.balanceDue) || 0;
        
        if (pType.includes("Unpaid") || orNum.startsWith("DUE-") || balDue > 0) {
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
      results = Array.from(payers.values()).map((p: any) => ({
        ...p, status: p.balanceDue <= 0 ? "Fully Paid" : "Partially Paid", particulars: p.items.join(" ; "), duration: ""
      }));

    } else if (reportCategory === "Penalty Fee") {
      const penMap = new Map();
      penalties.forEach((p: any) => {
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
      
      validCollections.forEach((c: any) => {
        if (c.itemDescription === "Penalty / Fines" || String(c.category).includes("Penalty")) {
          const sInfo = getStudentData(c.studentId, c.studentName);
          if (penMap.has(sInfo.key)) penMap.get(sInfo.key).amountPaid += (Number(c.amountPaid) || 0);
        }
      });

      results = Array.from(penMap.values()).map((p: any) => {
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
      const itemPayers = new Map();
      validCollections.forEach((c: any) => {
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
      results = Array.from(itemPayers.values()).map((ip: any) => {
        const netBal = ip.rate > 0 ? Math.max(0, ip.rate - ip.amountPaid) : 0;
        return {
          ...ip, assessedAmount: ip.rate, balanceDue: netBal,
          status: (netBal <= 0 && (ip.rate === 0 || ip.amountPaid >= ip.rate)) ? "Fully Paid" : "Partially Paid", particulars: ip.orNumbers.join(", "), duration: ""
        };
      });
    }

    return results.sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [students, validCollections, penalties, reportCategory, term, packageRate, termPkgItems]);

  const filteredRoster = computedRoster.filter((row: any) => {
    if (statusFilter === "Fully Paid Only" && row.status !== "Fully Paid" && row.status !== "Settled (Service)") return false;
    if (statusFilter === "Partially Paid Only" && row.status !== "Partially Paid") return false;
    if (statusFilter === "Unpaid Only" && row.status !== "Unpaid") return false;
    if (yearFilter !== "All Year Levels" && row.yearLevel !== yearFilter) return false;
    return true; 
  });

  const groupedRoster = filteredRoster.reduce((acc: any, row: any) => {
    const yr = row.yearLevel || "Unassigned";
    if (!acc[yr]) acc[yr] = [];
    acc[yr].push(row);
    return acc;
  }, {} as Record<string, ReportRow[]>);

  const sortedYearLevels = ["1st Year", "2nd Year", "3rd Year", "4th Year", "Unassigned"].filter((y: string) => groupedRoster[y]);

  const fullyPaidCount = filteredRoster.filter((r: any) => r.status === "Fully Paid" || r.status === "Settled (Service)").length;
  const partialCount = filteredRoster.filter((r: any) => r.status === "Partially Paid").length;
  const unpaidCount = filteredRoster.filter((r: any) => r.status === "Unpaid").length;

  const isPenaltyReport = reportCategory === "Penalty Fee";
  const isLiquidationReport = reportCategory === "Liquidation / Audited Expenses";

  const handleExportCsv = () => {
    let csv = "";
    
    if (isLiquidationReport) {
      if (validLiquidations.length === 0) return alert("No liquidation records to export.");
      csv = `Date,Audit ID,CA Reference,Officer / Requestor,Fund Source,Budget (CA),Liquidated Exp.,Cash Return (Surplus),Reimburse Due\n`;
      validLiquidations.forEach((l: any) => {
        const budget = (Number(l.totalExpense)||0) + (Number(l.varianceReturn)||0) - (Number(l.reimbursementDue)||0);
        const rawDate = l.date ? String(l.date).split('T')[0] : '—';
        csv += `"${rawDate}","${l.auditId}","${l.referenceCaId || l.advanceId || ''}","${l.requestor}","${l.fundSource}",${budget},${l.totalExpense},${l.varianceReturn||0},${l.reimbursementDue||0}\n`;
      });
    } else if (isPenaltyReport) {
      if (sortedYearLevels.length === 0) return alert("No penalty records to export.");
      csv = `Year Level,Student ID,Student Name,Duration,Assessed Fee,Amount Paid,Balance Due,Status,Particulars\n`;
      sortedYearLevels.forEach((yr: string) => {
        groupedRoster[yr].forEach((s: any) => {
          csv += `"${yr}","${s.studentId}","${s.fullName}","${s.duration}",${s.assessedAmount},${s.amountPaid},${s.balanceDue},"${s.status}","${s.particulars}"\n`;
        });
      });
    } else {
      if (sortedYearLevels.length === 0) return alert("No records to export for this category.");
      const headerName = reportCategory === "Activity & Item Dues (Unpaid)" ? "Remarks" : "OR Number(s) / Remarks";
      csv = `Year Level,Student ID,Student Name,Assessed Fee,Amount Paid,Balance Due,Status,${headerName}\n`;
      sortedYearLevels.forEach((yr: string) => {
        groupedRoster[yr].forEach((s: any) => {
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

  const pieData = {
    labels: ['Fully Paid / Cleared', 'Partially Paid', 'Unpaid / Deficit'],
    datasets: [{
      data: [fullyPaidCount, partialCount, unpaidCount],
      backgroundColor: ['#22c55e', '#eab308', '#ef4444'],
      borderWidth: 1,
      borderColor: 'currentColor'
    }]
  };

  const barData = {
    labels: sortedYearLevels,
    datasets: [{
      label: 'Total Collections (₱)',
      data: sortedYearLevels.map((yr: string) => groupedRoster[yr].reduce((sum: number, s: any) => sum + s.amountPaid, 0)),
      backgroundColor: '#0dcaf0',
      borderRadius: 4
    }]
  };

  const chartOptionsBase = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: 'inherit' } } },
    scales: { 
      x: { grid: { color: 'rgba(100, 100, 100, 0.15)' }, ticks: { color: 'inherit' } }, 
      y: { grid: { color: 'rgba(100, 100, 100, 0.15)' }, ticks: { color: 'inherit' } } 
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page {
            size: 8.5in 13in;
            margin: 0.5in; 
          }
          
          aside, nav, header, footer, .sidebar, .d-print-none { 
            display: none !important; 
          }
          
          html, body, main, #__next, .layout-wrapper {
            margin: 0 !important; padding: 0 !important; width: 100% !important; 
            height: auto !important; min-height: auto !important; background-color: white !important;
            overflow: visible !important; position: static !important;
          }
          
          .print-container {
            width: 100% !important; margin: 0 !important; padding: 0 !important; 
            border: none !important; box-shadow: none !important; background-color: white !important;
          }
          
          .print-container * { color: #000000 !important; background-color: transparent !important; }
          .print-container .bg-dark, .print-container .table-dark { background-color: #f8f9fa !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          
          .print-container table { border-collapse: collapse !important; margin-bottom: 15px !important; width: 100% !important; border: 1.5px solid #000000 !important; }
          .print-container th, .print-container td { border: 1px solid #000000 !important; padding: 5px 8px !important; }
          
          .print-container thead { display: table-header-group !important; }
          .print-container tr { page-break-inside: avoid !important; }
          .signature-block { margin-top: 40px !important; page-break-inside: avoid !important; }
        }
      `}} />

      <div className="print-container">
        {/* ISO PRINT HEADER */}
        <div className="d-none d-print-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-dark border-opacity-50">
          <div style={{ width: '90px', flexShrink: 0 }} className="text-center">
            <img src={getAssetUrl('fcu.png')} alt="FCU Logo" style={{ width: '100%', maxHeight: '90px', objectFit: 'contain' }} />
          </div>
          <div className="text-center flex-grow-1 px-3">
            <div className="fw-bold text-uppercase" style={{ fontSize: '0.9rem', letterSpacing: '0.5px' }}>Filamer Christian University</div>
            <div className="fw-bold text-uppercase text-info" style={{ fontSize: '1.1rem' }}>{orgName}</div>
            <div className="text-muted small">Roxas Avenue, Roxas City, Capiz, Philippines 5800</div>
            <div className="mt-3 fw-bold text-uppercase" style={{ fontSize: '0.95rem' }}>Detailed Audit & Financial Report ({reportCategory})</div>
            <div className="text-muted small fst-italic mt-1">{ay} &nbsp;|&nbsp; {term}</div>
          </div>
          <div style={{ width: '90px', flexShrink: 0 }} className="text-center">
            <img 
              src={logoUrl || getAssetUrl('engineering_logo.png')} 
              alt="Entity Logo" 
              style={{ width: '100%', maxHeight: '90px', objectFit: 'contain' }} 
            />
          </div>
        </div>

        {/* SCREEN TOOLBAR */}
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3 d-print-none">
          <div>
            <h5 className="text-info fw-bold mb-0"><i className="bi bi-bar-chart-fill me-2"></i>Institutional Collections & Liquidation Reports</h5>
          </div>
          <div className="d-print-none">
            <button className="btn btn-outline-info btn-sm fw-bold me-2" onClick={() => setShowSettings(true)}>
              <i className="bi bi-gear-fill me-1"></i>Report Settings
            </button>
            <button className="btn btn-outline-secondary btn-sm fw-bold" onClick={() => window.print()}>
              <i className="bi bi-printer me-1"></i>Print Report
            </button>
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

        <div className="row g-3 mb-3 d-print-none">
          <div className="col-12 col-md-4">
            <label className="form-label text-body-secondary small mb-1">Report Category</label>
            <select className="form-select bg-body text-body border-secondary" value={reportCategory} onChange={e => setReportCategory(e.target.value)}>
              {hasPackageData && (
                <optgroup label="Core System Reports">
                  <option value="Departmental Fee (Package)">Departmental Fee (Package)</option>
                </optgroup>
              )}

              {hasUnpaidDues && (
                <optgroup label="Pending Accounts">
                  <option value="Activity & Item Dues (Unpaid)">Activity & Item Dues (Unpaid)</option>
                </optgroup>
              )}

              {dynamicCategories.length > 0 && (
                <optgroup label="Organization Collection Fees">
                  {dynamicCategories.map((cat: string, idx: number) => <option key={`dyn-${idx}`} value={cat}>{cat}</option>)}
                </optgroup>
              )}
              
              <optgroup label="Compliance & Audits">
                <option value="Penalty Fee">Penalty Fee / Sanctions</option>
                <option value="Liquidation / Audited Expenses">Liquidation / Audited Expenses</option>
              </optgroup>
            </select>
          </div>
          {!isLiquidationReport && (
            <>
              <div className="col-12 col-md-3">
                <label className="form-label text-body-secondary small mb-1">Year Level Filter</label>
                <select className="form-select bg-body text-body border-secondary" value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
                  <option value="All Year Levels">All Year Levels</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </div>
              <div className="col-12 col-md-3">
                <label className="form-label text-body-secondary small mb-1">Payment Status Filter</label>
                <select className="form-select bg-body text-body border-secondary" value={statusFilter} onChange={e => setStatusFilter(e.target.value)} disabled={isPenaltyReport}>
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
          <div className="border border-secondary rounded p-2 mb-3 shadow-sm d-flex gap-3 px-3 d-print-none bg-body-secondary">
            <span className="text-body fw-bold small">{ay} ({term}) — {reportCategory}: {filteredRoster.length} student(s) displayed</span>
            <span className="text-muted">|</span>
            <span className="text-success fw-bold small">{fullyPaidCount} Fully Paid / Cleared</span>
            <span className="text-muted">|</span>
            <span className="text-warning fw-bold small">{partialCount} Partially Paid</span>
            {unpaidCount > 0 && (
              <>
                <span className="text-muted">|</span>
                <span className="text-danger fw-bold small">{unpaidCount} Unpaid</span>
              </>
            )}
          </div>
        )}

        {viewMode === "Analytics" && !isLiquidationReport && (
          <div className="row g-3 mb-4 d-print-none">
            <div className="col-12 col-md-6">
              <div className="card p-3 border-secondary bg-body shadow-sm h-100">
                <h6 className="text-info fw-bold mb-3">Collection Status Breakdown</h6>
                <div style={{ position: 'relative', height: '280px' }}>
                  <Doughnut data={pieData} options={{ ...chartOptionsBase, plugins: { legend: { position: 'bottom' } } }} />
                </div>
              </div>
            </div>
            <div className="col-12 col-md-6">
              <div className="card p-3 border-secondary bg-body shadow-sm h-100">
                <h6 className="text-info fw-bold mb-3">Collections by Year Level</h6>
                <div style={{ position: 'relative', height: '280px' }}>
                  <Bar data={barData} options={{ ...chartOptionsBase, plugins: { legend: { display: false } } }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {viewMode === "Analytics" && isLiquidationReport && (
          <div className="text-center text-muted py-5 d-print-none">
            <i className="bi bi-bar-chart-line fs-1 d-block mb-2 opacity-50"></i>
            Analytics charts are available for student collections, fees, and penalties.
          </div>
        )}

        {!isLiquidationReport && viewMode === "Table" && (
          <div className="report-groups-container">
            {sortedYearLevels.length === 0 ? (
              <div className="text-center text-muted py-4">No records found for the selected filters.</div>
            ) : (
              sortedYearLevels.map((yr: string) => {
                let lastColumnHeader = "OR Number(s)";
                if (isPenaltyReport) {
                  lastColumnHeader = "Activities & Breakdown";
                } else if (reportCategory === "Activity & Item Dues (Unpaid)") {
                  lastColumnHeader = "Remarks"; 
                } else {
                  const hasOR = groupedRoster[yr].some((row: any) => row.particulars && row.particulars !== "—");
                  if (!hasOR) lastColumnHeader = "Remarks";
                }

                return (
                  <div key={yr} className="mb-4">
                    <div className="badge bg-primary fs-6 mb-2 px-3 py-2 w-100 text-start">{yr} ({groupedRoster[yr].length} Students)</div>
                    <div className="table-responsive">
                      <table className="table table-hover align-middle table-sm border-secondary text-body">
                        <thead>
                          <tr className="text-secondary border-bottom border-secondary" style={{ fontSize: '0.85rem' }}>
                            <th className="py-2">Student ID</th>
                            <th className="py-2">Student Name</th>
                            {isPenaltyReport && <th className="py-2">Total Duration</th>}
                            <th className="py-2 text-end">Assessed Fee</th>
                            <th className="py-2 text-end">Amount Paid</th>
                            <th className="py-2 text-end">Balance Due</th>
                            <th className="py-2">Payment Status</th>
                            <th className="py-2">{lastColumnHeader}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupedRoster[yr].map((row: any, idx: number) => (
                            <tr key={`${row.id}-${idx}`}>
                              <td><span className="text-info font-monospace">{row.studentId}</span></td>
                              <td className="fw-semibold">{row.fullName}</td>
                              {isPenaltyReport && <td className="fw-semibold text-info">{row.duration}</td>}
                              <td className="text-end">{fmt(row.assessedAmount)}</td>
                              <td className="fw-bold text-info text-end">{fmt(row.amountPaid)}</td>
                              <td className={`text-end ${row.balanceDue > 0 ? 'text-danger fw-bold' : 'text-muted'}`}>{fmt(row.balanceDue)}</td>
                              <td>
                                <span className={`badge ${row.status === 'Fully Paid' || row.status === 'Settled (Service)' ? 'bg-success' : row.status === 'Partially Paid' ? 'bg-warning text-dark' : 'bg-danger'}`}>
                                  {row.status}
                                </span>
                              </td>
                              <td className="text-muted small" style={{ maxWidth: '300px' }}>{row.particulars}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {isLiquidationReport && viewMode === "Table" && (
          <div>
            <div className="border border-secondary rounded p-2 mb-3 shadow-sm px-3 d-print-none bg-body-secondary">
              <span className="text-body fw-bold small">{ay} ({term}) — Liquidation Audits: {validLiquidations.length} records found</span>
            </div>
            <div className="table-responsive">
              <table className="table table-hover align-middle table-sm border-secondary text-body">
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
                    <tr><td colSpan={8} className="text-center text-muted py-4">No audited liquidation records found.</td></tr>
                  ) : (
                    validLiquidations.map((l: any, idx: number) => {
                      const budget = (Number(l.totalExpense)||0) + (Number(l.varianceReturn)||0) - (Number(l.reimbursementDue)||0);
                      let resultBadge = <span className="badge bg-secondary">Exact (₱0.00)</span>;
                      if (Number(l.varianceReturn) > 0) resultBadge = <span className="badge bg-success">+{fmt(l.varianceReturn)} (Return)</span>;
                      else if (Number(l.reimbursementDue) > 0) resultBadge = <span className="badge bg-danger">-{fmt(l.reimbursementDue)} (Reimburse)</span>;

                      return (
                        <tr key={`${l.id}-${idx}`}>
                          <td className="text-muted small">{l.date ? String(l.date).split('T')[0] : '—'}</td>
                          <td><strong>{l.auditId}</strong></td>
                          <td><span className="text-info">{l.referenceCaId || l.advanceId || '—'}</span></td>
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

        {/* DYNAMIC SIGNATURE BLOCK */}
        <div className="d-none d-print-flex row mt-4 pt-3 text-body signature-block" style={{ fontSize: '0.85rem' }}>
          {signatories && signatories.length > 0 ? (
            signatories.map((sig: any, idx: number) => (
              <div className="col text-center" key={idx}>
                <div className="fw-bold text-uppercase text-muted mb-1" style={{ fontSize: '0.75rem' }}>{sig.label}</div>
                <div style={{ height: '40px' }}></div>
                <div className="fw-bold border-top border-dark pt-1 d-inline-block px-3">
                  {sig.name || "________________"}
                </div>
                <div className="text-muted mt-1" style={{ fontSize: '0.7rem' }}>
                  {sig.position || "Position"}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-muted small w-100">
              <em>No signatories configured. Please set them up using the "Report Settings" button.</em>
            </div>
          )}
        </div>
      </div>
      
      {/* =========================================================
          REPORT SETTINGS MODAL
      ========================================================= */}
      {showSettings && (
        <div className="modal fade show d-block d-print-none" tabIndex={-1} style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content bg-body border-secondary text-body shadow-lg">
              <div className="modal-header border-secondary">
                <h5 className="modal-title fw-bold text-info">
                  <i className="bi bi-pen-fill me-2"></i>Configure Signatories
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowSettings(false)}></button>
              </div>
              <div className="modal-body p-4">
                <p className="small text-muted mb-3">
                  Customize the official signatories for this department. Dragging/reordering is determined by the order they appear below.
                </p>

                {signatories.map((sig: any, idx: number) => (
                  <div key={idx} className="row g-2 mb-3 align-items-center bg-body-secondary p-2 rounded border border-secondary">
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold text-muted mb-1">Action / Label</label>
                      <select 
                        className="form-select form-select-sm bg-body text-body border-secondary" 
                        value={sig.label} 
                        onChange={(e) => handleUpdateSignatory(idx, 'label', e.target.value)}
                      >
                        {labelOptions.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold text-muted mb-1">Full Name</label>
                      <input 
                        type="text" 
                        className="form-control form-control-sm bg-body text-body border-secondary" 
                        placeholder="e.g. Juan Dela Cruz" 
                        value={sig.name} 
                        onChange={(e) => handleUpdateSignatory(idx, 'name', e.target.value)}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold text-muted mb-1">Position / Title</label>
                      <input 
                        type="text" 
                        className="form-control form-control-sm bg-body text-body border-secondary" 
                        placeholder="e.g. Internal Auditor" 
                        value={sig.position} 
                        onChange={(e) => handleUpdateSignatory(idx, 'position', e.target.value)}
                      />
                    </div>
                    <div className="col-md-1 text-end mt-4">
                      <button className="btn btn-outline-danger btn-sm" onClick={() => handleRemoveSignatory(idx)} title="Remove">
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                ))}

                <button className="btn btn-outline-secondary btn-sm w-100 fw-bold border-dashed mt-2" onClick={handleAddSignatory}>
                  <i className="bi bi-plus-lg me-1"></i> Add Signatory
                </button>
              </div>
              <div className="modal-footer border-secondary">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                  setSignatories(initialSignatories); 
                  setShowSettings(false);
                }}>Cancel</button>
                <button type="button" className="btn btn-info btn-sm text-dark fw-bold" onClick={handleSaveSignatories} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Signatories"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </> 
  );
}