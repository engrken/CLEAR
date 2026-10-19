// /app/department/[department]/(protected)/reports/ReportsClient.tsx

"use client";
import { manilaDateInput } from "@/lib/clear-timezone";
import { clearAlert, clearConfirm, clearPrompt } from "@/lib/clear-dialogs";


import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveSignatories, saveReportSettings } from "../../actions";
import { fmt } from "@/lib/utils";
import OrganizationLogo from "@/components/OrganizationLogo";
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

// Normalize missing or legacy year-level values so they can always be grouped.
function normalizeYearLevel(value: unknown): string {
  const raw = String(value ?? "").trim();
  const normalized = raw.toLowerCase().replace(/\s+/g, " ");

  const aliases: Record<string, string> = {
    "": "Unassigned",
    "n/a": "Unassigned",
    "na": "Unassigned",
    "not applicable": "Unassigned",
    "not assigned": "Unassigned",
    "unassigned": "Unassigned",
    "unknown": "Unassigned",
    "none": "Unassigned",
    "null": "Unassigned",
    "undefined": "Unassigned",
    "1": "1st Year",
    "1st": "1st Year",
    "1st year": "1st Year",
    "first year": "1st Year",
    "year 1": "1st Year",
    "2": "2nd Year",
    "2nd": "2nd Year",
    "2nd year": "2nd Year",
    "second year": "2nd Year",
    "year 2": "2nd Year",
    "3": "3rd Year",
    "3rd": "3rd Year",
    "3rd year": "3rd Year",
    "third year": "3rd Year",
    "year 3": "3rd Year",
    "4": "4th Year",
    "4th": "4th Year",
    "4th year": "4th Year",
    "fourth year": "4th Year",
    "year 4": "4th Year",
    "5": "5th Year",
    "5th": "5th Year",
    "5th year": "5th Year",
    "fifth year": "5th Year",
    "year 5": "5th Year",
    "6": "6th Year",
    "6th": "6th Year",
    "6th year": "6th Year",
    "sixth year": "6th Year",
    "year 6": "6th Year",
  };

  return aliases[normalized] || raw || "Unassigned";
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
  schoolName: suppliedSchoolName = "",
  schoolAddress: suppliedSchoolAddress = "",
  reportSchoolName = "",
  reportSchoolAddress = "",
  reportHeaderLeftLogo = "",
  reportHeaderRightLogo = "",
  termPkgItems = [],
  remainingBalance = 0,
  carriedIn = 0,
  carriedOut = 0,
}: any) {
  const router = useRouter();

  // =========================================================
  // SETTINGS MODAL STATE
  // =========================================================
  const [showSettings, setShowSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [signatories, setSignatories] = useState(initialSignatories || []);
  const [schoolName, setSchoolName] = useState(String(reportSchoolName || suppliedSchoolName || ""));
  const [schoolAddress, setSchoolAddress] = useState(String(reportSchoolAddress || suppliedSchoolAddress || ""));
  const [leftLogoFile, setLeftLogoFile] = useState<File | null>(null);
  const [rightLogoFile, setRightLogoFile] = useState<File | null>(null);

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

  const handleSaveReportSettings = async () => {
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("schoolName", schoolName.trim());
      formData.append("schoolAddress", schoolAddress.trim());
      if (leftLogoFile) formData.append("leftLogo", leftLogoFile);
      if (rightLogoFile) formData.append("rightLogo", rightLogoFile);

      // These settings are saved on the Organization and reused by all report printouts.
      await saveReportSettings(department, formData);
      await saveSignatories(orgId, department, signatories);
      setLeftLogoFile(null);
      setRightLogoFile(null);
      setShowSettings(false);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      void clearAlert(`Failed to save report settings: ${message}`);
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

  const validCollections = collections.filter((c: any) =>
    !String(c.paymentType || "").toUpperCase().includes("VOID") &&
    !String(c.status || "").toUpperCase().includes("VOID") &&
    !String(c.status || "").toUpperCase().includes("CANCEL")
  );
  const validLiquidations = liquidations.filter(
    (l: any) => !String(l.status || "").toUpperCase().includes("VOID")
  );

  // Explicit generics prevent TypeScript from inferring Set/Array values as unknown.
  const availableYearLevels: string[] = Array.from(
    new Set<string>(
      (students as any[]).map((student: any): string =>
        normalizeYearLevel(student?.yearLevel)
      )
    )
  ).sort((a: string, b: string) => {
    if (a === "Unassigned") return b === "Unassigned" ? 0 : 1;
    if (b === "Unassigned") return -1;

    const order = ["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year", "6th Year"];
    const aIndex = order.indexOf(a);
    const bIndex = order.indexOf(b);

    if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
    if (aIndex >= 0) return -1;
    if (bIndex >= 0) return 1;
    return a.localeCompare(b);
  });

  // =========================================================
  // DYNAMIC CATEGORY RESOLUTION
  // =========================================================
  const hasPackageData = termPkgItems.length > 0 || packageRate > 0 || validCollections.some((c: any) => String(c.itemDescription || '').toLowerCase().includes('package') || String(c.itemDescription || '').toLowerCase() === 'departmental fee');
  const hasUnpaidDues = validCollections.some((c: any) => String(c.paymentType || "").includes("Unpaid") || String(c.orNumber || "").toUpperCase().startsWith("DUE-") || Number(c.balanceDue) > 0);

  // Strictly use configured fee *categories*, not item names or receipt descriptions.
  const dynamicCategories = Array.from(new Set<string>(
    (setupCategories || []).map((name: string) => String(name).trim()).filter(Boolean)
  )).sort((a, b) => a.localeCompare(b));

  const defaultCategory = hasUnpaidDues ? "Activity & Item Dues (Unpaid)" : (dynamicCategories[0] || "Liquidation / Audited Expenses");

  const [reportCategory, setReportCategory] = useState(defaultCategory);
  const [statusFilter, setStatusFilter] = useState("All Students (Master Roster)");
  const [yearFilter, setYearFilter] = useState("All Year Levels");
  const [viewMode, setViewMode] = useState<"Table" | "Analytics">("Table");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [reportCategory, statusFilter, yearFilter, pageSize, viewMode]);
  // Account-period or Fee Setup changes may remove a previously selected
  // category. Return to a valid report instead of showing an empty selector.
  const categoryKey = dynamicCategories.join("\u001f");
  useEffect(() => {
    const options = [
      ...dynamicCategories,
      "Penalty Fee",
      "Liquidation / Audited Expenses",
      ...(hasPackageData ? ["Departmental Fee (Package)"] : []),
      ...(hasUnpaidDues ? ["Activity & Item Dues (Unpaid)"] : []),
    ];
    if (!options.includes(reportCategory)) setReportCategory(defaultCategory);
  }, [ay, term, categoryKey, reportCategory, defaultCategory, hasPackageData, hasUnpaidDues]);

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
        yearLevel: normalizeYearLevel(s?.yearLevel)
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
          id: student.id, studentId: student.studentId, fullName: student.fullName, yearLevel: normalizeYearLevel(student.yearLevel),
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
        if (/VOID|CANCEL/i.test(status)) return;
        
        const sInfo = getStudentData(p.studentId, p.studentName);
        if (!penMap.has(sInfo.key)) {
          penMap.set(sInfo.key, { ...sInfo, originalAssessed: 0, outstanding: 0, amountPaid: 0, totalHours: 0, settledByService: false, activities: [] });
        }
        
        const pt = penMap.get(sInfo.key);
        const fine = Number(p.fineAmount || p.fine || 0);
        const hrs = Number(p.hoursLate || p.hours || 0);
        // Current penalty.fineAmount is the outstanding balance after payments;
        // original assessed amount is reconstructed from duration * hourly rate.
        pt.originalAssessed += Math.round(hrs * Number(p.ratePerHour || 0) * 100) / 100;
        pt.outstanding += fine;
        pt.totalHours += hrs;
        if (/SETTLED.*COMMUNITY SERVICE/i.test(status)) pt.settledByService = true;

        let actLabel = `${p.activity} [${formatHoursAndMinutes(hrs)}]`;
        if (/COMMUNITY SERVICE|PARTIALLY SERVED/i.test(status)) actLabel += " (Service)";
        pt.activities.push(actLabel);
      });
      
      validCollections.forEach((c: any) => {
        if (/^Penalty Fine(?:\s*\[|:)/i.test(String(c.itemDescription || "")) || /^Penalty(?: \/ Fines)?$/i.test(String(c.category || ""))) {
          const sInfo = getStudentData(c.studentId, c.studentName);
          if (penMap.has(sInfo.key)) penMap.get(sInfo.key).amountPaid += (Number(c.amountPaid) || 0);
        }
      });

      results = Array.from(penMap.values()).map((p: any) => {
        // Cash receipts have already reduced Penalty.fineAmount. Never subtract
        // the same cash payments a second time in the detailed report.
        const balanceDue = Math.max(0, Math.round(p.outstanding * 100) / 100);
        const assessedAmount = Math.max(p.originalAssessed, balanceDue + p.amountPaid);
        const status = balanceDue <= 0
          ? (p.settledByService && p.amountPaid === 0 ? "Settled (Service)" : "Fully Paid")
          : p.amountPaid > 0 ? "Partially Paid" : "Unpaid";
        return {
          ...p, assessedAmount, balanceDue,
          duration: formatHoursAndMinutes(p.totalHours), status,
          particulars: p.activities.join(" ; ")
        };
      });

    } else {
      const itemPayers = new Map();
      validCollections.forEach((c: any) => {
        if (String(c.category || "").trim().toLowerCase() === reportCategory.trim().toLowerCase()) {
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

  // Render every year-level group that actually exists in the filtered data.
  // Previously, this hardcoded list silently hid values such as "N/A" or "5th Year",
  // even when the status banner counted those students.
  const preferredYearOrder = [
    "1st Year",
    "2nd Year",
    "3rd Year",
    "4th Year",
    "5th Year",
    "6th Year",
  ];

  const sortedYearLevels = Object.keys(groupedRoster).sort((a: string, b: string) => {
    if (a === "Unassigned") return b === "Unassigned" ? 0 : 1;
    if (b === "Unassigned") return -1;

    const aIndex = preferredYearOrder.indexOf(a);
    const bIndex = preferredYearOrder.indexOf(b);

    if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
    if (aIndex >= 0) return -1;
    if (bIndex >= 0) return 1;

    return a.localeCompare(b);
  });

  // Pagination is display-only. Analytics and CSV continue to use *all* filtered
  // records, not just the visible page.
  const liquidationRows = validLiquidations.slice().sort((a: any, b: any) =>
    String(b.date || "").localeCompare(String(a.date || "")));
  const isLiquidationCategory = reportCategory === "Liquidation / Audited Expenses";
  const totalRecords = isLiquidationCategory ? liquidationRows.length : filteredRoster.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const pagedRoster = filteredRoster.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedLiquidations = liquidationRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pagedGroups = pagedRoster.reduce((acc: Record<string, ReportRow[]>, row: ReportRow) => {
    const key = row.yearLevel || "Unassigned";
    (acc[key] ||= []).push(row);
    return acc;
  }, {});
  const pagedYears = sortedYearLevels.filter(yr => Boolean(pagedGroups[yr]));

  const fullyPaidCount = filteredRoster.filter((r: any) => r.status === "Fully Paid" || r.status === "Settled (Service)").length;
  const partialCount = filteredRoster.filter((r: any) => r.status === "Partially Paid").length;
  const unpaidCount = filteredRoster.filter((r: any) => r.status === "Unpaid").length;

  const isPenaltyReport = reportCategory === "Penalty Fee";
  const isLiquidationReport = reportCategory === "Liquidation / Audited Expenses";

  const handleExportCsv = () => {
    let csv = "";
    
    if (isLiquidationReport) {
      if (validLiquidations.length === 0) return void clearAlert("No liquidation records to export.");
      csv = `Date,Audit ID,CA Reference,Officer / Requestor,Fund Source,Budget (CA),Liquidated Exp.,Cash Return (Surplus),Reimburse Due\n`;
      validLiquidations.forEach((l: any) => {
        const budget = (Number(l.totalExpense)||0) + (Number(l.varianceReturn)||0) - (Number(l.reimbursementDue)||0);
        const rawDate = l.date ? manilaDateInput(l.date) : '—';
        csv += `"${rawDate}","${l.auditId}","${l.referenceCaId || l.advanceId || ''}","${l.requestor}","${l.fundSource}",${budget},${l.totalExpense},${l.varianceReturn||0},${l.reimbursementDue||0}\n`;
      });
    } else if (isPenaltyReport) {
      if (sortedYearLevels.length === 0) return void clearAlert("No penalty records to export.");
      csv = `Year Level,Student ID,Student Name,Duration,Assessed Fee,Amount Paid,Balance Due,Status,Particulars\n`;
      sortedYearLevels.forEach((yr: string) => {
        groupedRoster[yr].forEach((s: any) => {
          csv += `"${yr}","${s.studentId}","${s.fullName}","${s.duration}",${s.assessedAmount},${s.amountPaid},${s.balanceDue},"${s.status}","${s.particulars}"\n`;
        });
      });
    } else {
      if (sortedYearLevels.length === 0) return void clearAlert("No records to export for this category.");
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
          
          /* Removed the 1.5px outer border here */
          .print-container table { border-collapse: collapse !important; margin-bottom: 15px !important; width: 100% !important; }
          .print-container th, .print-container td { border: 1px solid #000000 !important; padding: 5px 8px !important; }
          
          .print-container thead { display: table-header-group !important; }
          .print-container tr { page-break-inside: avoid !important; }
          .signature-block { margin-top: 40px !important; page-break-inside: avoid !important; }
        }
      `}} />

      <div className="print-container">
        {/* PRINT HEADER: use the Organization's saved report settings, not hard-coded institution details */}
        <div className="d-none d-print-flex justify-content-between align-items-center mb-3 pb-2 border-bottom border-dark border-opacity-50">
          <div style={{ width: '90px', minWidth: '90px', flexShrink: 0 }} className="text-center">
            {reportHeaderLeftLogo ? (
              <img src={reportHeaderLeftLogo} alt="School logo" style={{ width: '100%', maxHeight: '90px', objectFit: 'contain' }} />
            ) : <div aria-hidden="true" />}
          </div>
          <div className="text-center flex-grow-1 px-3">
            {schoolName.trim() ? <div className="fw-bold text-uppercase" style={{ fontSize: '1.1rem' }}>{schoolName.trim()}</div> : null}
            <div className="fw-bold text-uppercase" style={{ fontSize: '0.9rem', letterSpacing: '0.5px' }}>{orgName}</div>
            {schoolAddress.trim() ? <div className="small">{schoolAddress.trim()}</div> : null}
            <div className="mt-3 fw-bold text-uppercase" style={{ fontSize: '0.95rem' }}>Detailed Audit & Financial Report ({reportCategory})</div>
            <div className="small fst-italic mt-1">{ay} &nbsp;|&nbsp; {term}</div>
          </div>
          <div style={{ width: '90px', minWidth: '90px', flexShrink: 0 }} className="text-center">
            <OrganizationLogo
              src={reportHeaderRightLogo || logoUrl}
              alt={`${orgName} logo`}
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

        {(Number(carriedIn) > 0 || Number(carriedOut) > 0) && (
          <div className="alert alert-info small d-print-none">
            Period available balance: <strong>{fmt(remainingBalance)}</strong>.
            Carry-over received: <strong>{fmt(carriedIn)}</strong>; forwarded:
            <strong> {fmt(carriedOut)}</strong>. These are balance transfers,
            not student payments or new income.
          </div>
        )}
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
                <optgroup label="Categories from Setup Collection Fees">
                  {dynamicCategories.map((cat: string, idx: number) => <option key={`dyn-${idx}`} value={cat}>{cat}</option>)}
                </optgroup>
              )}
              
              <optgroup label="System Reports (not fee categories)">
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
                  {availableYearLevels.map((level: string) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
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
            {pagedYears.length === 0 ? (
              <div className="text-center text-muted py-4">No records found for the selected filters.</div>
            ) : (
              pagedYears.map((yr: string) => {
                let lastColumnHeader = "OR Number(s)";
                if (isPenaltyReport) {
                  lastColumnHeader = "Activities & Breakdown";
                } else if (reportCategory === "Activity & Item Dues (Unpaid)") {
                  lastColumnHeader = "Remarks"; 
                } else {
                  const hasOR = pagedGroups[yr].some((row: any) => row.particulars && row.particulars !== "—");
                  if (!hasOR) lastColumnHeader = "Remarks";
                }

                return (
                  <div key={yr} className="mb-4">
                    <div className="badge bg-primary fs-6 mb-2 px-3 py-2 w-100 text-start">{yr} ({pagedGroups[yr].length} Students)</div>
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
                          {pagedGroups[yr].map((row: any, idx: number) => (
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
                    pagedLiquidations.map((l: any, idx: number) => {
                      const budget = (Number(l.totalExpense)||0) + (Number(l.varianceReturn)||0) - (Number(l.reimbursementDue)||0);
                      let resultBadge = <span className="badge bg-secondary">Exact (₱0.00)</span>;
                      if (Number(l.varianceReturn) > 0) resultBadge = <span className="badge bg-success">+{fmt(l.varianceReturn)} (Return)</span>;
                      else if (Number(l.reimbursementDue) > 0) resultBadge = <span className="badge bg-danger">-{fmt(l.reimbursementDue)} (Reimburse)</span>;

                      return (
                        <tr key={`${l.id}-${idx}`}>
                          <td className="text-muted small">{l.date ? manilaDateInput(l.date) : '—'}</td>
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

        {viewMode === "Table" && (
          <div className="d-print-none d-flex align-items-center justify-content-between flex-wrap gap-2 mt-3 mb-3 border-top border-secondary pt-3">
            <div className="d-flex align-items-center gap-2">
              <label className="small text-muted" htmlFor="clear-report-page-size">Rows per page</label>
              <select id="clear-report-page-size" className="form-select form-select-sm border-secondary" style={{ width: 90 }} value={pageSize}
                onChange={e => setPageSize(Number(e.target.value))}>
                <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option>
              </select>
              <span className="small text-muted">
                {totalRecords === 0 ? "0" : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, totalRecords)}`} of {totalRecords}
              </span>
            </div>
            <nav aria-label="Detailed report pagination" className="btn-group btn-group-sm">
              <button type="button" className="btn btn-outline-secondary" disabled={safePage === 1} onClick={() => setPage(1)}>First</button>
              <button type="button" className="btn btn-outline-secondary" disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
              <span className="btn btn-outline-secondary disabled">Page {safePage} / {totalPages}</span>
              <button type="button" className="btn btn-outline-secondary" disabled={safePage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
              <button type="button" className="btn btn-outline-secondary" disabled={safePage === totalPages} onClick={() => setPage(totalPages)}>Last</button>
            </nav>
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
            <div className="modal-content bg-body border-secondary text-body shadow-lg clear-theme-modal">
              <div className="modal-header border-secondary">
                <h5 className="modal-title fw-bold text-info">
                  <i className="bi bi-gear-fill me-2"></i>Report Settings
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowSettings(false)}></button>
              </div>
              <div className="modal-body p-4">
                <p className="small text-muted mb-3">
                  These institution details and logo images are shared by the Summary, Reports, and Audited Liquidation History printouts. The organization/department name remains the registered organization name.
                </p>

                <div className="border border-secondary rounded p-3 mb-4">
                  <h6 className="fw-bold text-info mb-3">Institution / Print Header</h6>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">School Name</label>
                    <input className="form-control bg-body text-body border-secondary" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Enter school or institution name" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Organization / Department Name</label>
                    <input className="form-control bg-body-secondary text-body border-secondary" value={orgName || ""} readOnly />
                    <div className="form-text">This comes from the registered organization name and cannot be changed here.</div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">School Address</label>
                    <textarea className="form-control bg-body text-body border-secondary" value={schoolAddress} onChange={(e) => setSchoolAddress(e.target.value)} rows={2} placeholder="Enter school address" />
                  </div>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Left Header Logo</label>
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="form-control form-control-sm bg-body text-body border-secondary" onChange={(e) => setLeftLogoFile(e.target.files?.[0] || null)} />
                      {reportHeaderLeftLogo && <div className="small text-muted mt-1">A left logo is currently saved. Upload another file to replace it.</div>}
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Right Header Logo</label>
                      <input type="file" accept="image/png,image/jpeg,image/webp" className="form-control form-control-sm bg-body text-body border-secondary" onChange={(e) => setRightLogoFile(e.target.files?.[0] || null)} />
                      {(reportHeaderRightLogo || logoUrl) && <div className="small text-muted mt-1">A right logo is currently available. Upload another file to replace it.</div>}
                    </div>
                  </div>
                </div>

                <h6 className="fw-bold text-info mb-3">Report Signatories</h6>
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
                  setSignatories(initialSignatories || []);
                  setSchoolName(String(reportSchoolName || suppliedSchoolName || ""));
                  setSchoolAddress(String(reportSchoolAddress || suppliedSchoolAddress || ""));
                  setLeftLogoFile(null);
                  setRightLogoFile(null);
                  setShowSettings(false);
                }}>Cancel</button>
                <button type="button" className="btn btn-info btn-sm text-dark fw-bold" onClick={handleSaveReportSettings} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Report Settings"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </> 
  );
}