// /app/department/[department]/(protected)/summary/SummaryClient.tsx


"use client";

import { useState, useEffect } from "react";
import { fmt } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  saveSignatories,
  saveReportSettings,
} from "../../actions";

interface ReportSignatory {
  id?: string;
  label: string;
  name: string;
  position: string;
  order?: number;
}

interface SummaryClientProps {
  department: string;
  orgId: string;
  orgName: string;
  logoUrl?: string | null;

  reportSchoolName?: string | null;
  reportSchoolAddress?: string | null;
  reportHeaderLeftLogo?: string | null;
  reportHeaderRightLogo?: string | null;

  initialSignatories?: ReportSignatory[];

  ay: string;
  term: string;

  summaryCategories?: { category: string; count: number; total: number }[];
  penaltySummary?: { count: number; amount: number };
  duesSummary?: { count: number; amount: number };
  grandCollectionTotal: number;
  expensesByFund: Record<string, number>;
  grandExpenseTotal: number;
  cashierBalance: number;
  totalDeposited: number;
  totalWithdrawn: number;
  remainingBalance: number;
  carryOverInboundTotal?: number;
  carryOverOutboundTotal?: number;
}

export default function SummaryClient({
  department,
  orgId,
  orgName,
  logoUrl,

  reportSchoolName,
  reportSchoolAddress,
  reportHeaderLeftLogo,
  reportHeaderRightLogo,

  initialSignatories,
  ay,
  term,
  summaryCategories = [],
  penaltySummary = { count: 0, amount: 0 },
  duesSummary = { count: 0, amount: 0 },
  grandCollectionTotal,
  expensesByFund,
  grandExpenseTotal,
  cashierBalance,
  totalDeposited,
  totalWithdrawn,
  remainingBalance,
  carryOverInboundTotal = 0,
  carryOverOutboundTotal = 0,
}: SummaryClientProps) {
  const router = useRouter();

  // Organization.name is the department/organization heading.
  const organizationName =
    String(orgName || department || "Organization").trim();

  // These two values are configurable through Report Settings.
  const reportSchoolHeading =
    String(reportSchoolName || "").trim();

  const reportAddress =
    String(reportSchoolAddress || "").trim();

  const netBalance =
    remainingBalance !== undefined &&
    remainingBalance !== null
      ? Number(remainingBalance) || 0
      : (Number(grandCollectionTotal) || 0) -
        (Number(grandExpenseTotal) || 0);

  const safeBalance = Number(cashierBalance) || 0;

  const safeExpenses = expensesByFund || {};

  const [mounted, setMounted] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [isSavingHeader, setIsSavingHeader] = useState(false);
  const [isSavingSignatories, setIsSavingSignatories] =
    useState(false);

  // Report header settings
  const [schoolNameDraft, setSchoolNameDraft] = useState(
    String(reportSchoolName || "")
  );

  const [schoolAddressDraft, setSchoolAddressDraft] = useState(
    String(reportSchoolAddress || "")
  );

  const [leftLogoFile, setLeftLogoFile] = useState<File | null>(null);
  const [rightLogoFile, setRightLogoFile] = useState<File | null>(null);

  const [leftLogoInputKey, setLeftLogoInputKey] = useState(0);
  const [rightLogoInputKey, setRightLogoInputKey] = useState(0);

  const [leftLogoFailed, setLeftLogoFailed] = useState(false);
  const [rightLogoFailed, setRightLogoFailed] = useState(false);

  // Signatories
  const [signatories, setSignatories] = useState<ReportSignatory[]>(
    initialSignatories || []
  );

  const labelOptions = [
    "Prepared by:",
    "Attested by:",
    "Noted by:",
    "Endorsed by:",
    "Verified by:",
    "Approved by:",
  ];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Synchronize saved settings after router.refresh().
  useEffect(() => {
    setSchoolNameDraft(String(reportSchoolName || ""));
    setSchoolAddressDraft(String(reportSchoolAddress || ""));
    setLeftLogoFailed(false);
    setRightLogoFailed(false);
  }, [
    reportSchoolName,
    reportSchoolAddress,
    reportHeaderLeftLogo,
    reportHeaderRightLogo,
    logoUrl,
  ]);

  useEffect(() => {
    setSignatories(initialSignatories || []);
  }, [initialSignatories]);

  const getAssetUrl = (filename: string) => {
    if (
      mounted &&
      window.location.hostname.endsWith(".localhost")
    ) {
      return `http://localhost:${window.location.port}/${filename}`;
    }

    return `/${filename}`;
  };

  // The left logo defaults to the generic CLEAR System logo.
  const leftImageUrl =
    reportHeaderLeftLogo || getAssetUrl("clearsys.png");

  // The right logo defaults to the current organization's logo.
  const rightImageUrl =
    reportHeaderRightLogo || logoUrl || "";

  const organizationInitials = organizationName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  // =========================================================================
  // REPORT HEADER SETTINGS
  // =========================================================================

  const resetHeaderDrafts = () => {
    setSchoolNameDraft(String(reportSchoolName || ""));
    setSchoolAddressDraft(String(reportSchoolAddress || ""));

    setLeftLogoFile(null);
    setRightLogoFile(null);

    setLeftLogoInputKey((key) => key + 1);
    setRightLogoInputKey((key) => key + 1);

    setLeftLogoFailed(false);
    setRightLogoFailed(false);
  };

  const handleSaveHeaderSettings = async () => {
    const cleanSchoolName = schoolNameDraft.trim();
    const cleanAddress = schoolAddressDraft.trim();

    if (!cleanSchoolName) {
      window.alert("Please enter the School Name.");
      return;
    }

    if (cleanSchoolName.length > 200) {
      window.alert("School Name must not exceed 200 characters.");
      return;
    }

    if (cleanAddress.length > 300) {
      window.alert("School Address must not exceed 300 characters.");
      return;
    }

    const formData = new FormData();

    // These keys match the existing saveReportSettings server action.
    formData.append("schoolName", cleanSchoolName);
    formData.append("schoolAddress", cleanAddress);

    if (leftLogoFile) {
      formData.append("leftLogo", leftLogoFile);
    }

    if (rightLogoFile) {
      formData.append("rightLogo", rightLogoFile);
    }

    setIsSavingHeader(true);

    try {
      const result = await saveReportSettings(
        department,
        formData
      );

      resetHeaderDrafts();

      router.refresh();

      window.alert(
        result?.message ||
          "Report header settings saved successfully."
      );
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";

      window.alert(
        `Failed to save report header settings: ${message}`
      );
    } finally {
      setIsSavingHeader(false);
    }
  };

  // =========================================================================
  // SIGNATORY SETTINGS
  // =========================================================================

  const handleAddSignatory = () => {
    setSignatories((previous) => [
      ...previous,
      {
        label: "Prepared by:",
        name: "",
        position: "",
      },
    ]);
  };

  const handleUpdateSignatory = (
    index: number,
    field: keyof ReportSignatory,
    value: string
  ) => {
    setSignatories((previous) =>
      previous.map((signatory, currentIndex) =>
        currentIndex === index
          ? { ...signatory, [field]: value }
          : signatory
      )
    );
  };

  const handleRemoveSignatory = (index: number) => {
    setSignatories((previous) =>
      previous.filter((_, currentIndex) => currentIndex !== index)
    );
  };

  const handleSaveSignatories = async () => {
    setIsSavingSignatories(true);

    try {
      await saveSignatories(
        orgId,
        department,
        signatories
      );

      router.refresh();

      window.alert("Signatories saved successfully.");
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred.";

      window.alert(`Failed to save signatories: ${message}`);
    } finally {
      setIsSavingSignatories(false);
    }
  };

  const handleCancelSettings = () => {
    resetHeaderDrafts();
    setSignatories(initialSignatories || []);
    setShowSettings(false);
  };

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: 8.5in 13in;
                margin: 0.5in;
              }

              aside,
              nav,
              header,
              footer,
              .sidebar,
              .d-print-none {
                display: none !important;
              }

              html,
              body,
              main,
              #__next,
              .layout-wrapper {
                margin: 0 !important;
                padding: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                background-color: white !important;
              }

              .print-container {
                position: static !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                box-shadow: none !important;
                background-color: white !important;
              }

              .print-container * {
                color: #000000 !important;
                background-color: transparent !important;
              }

              .print-container table {
                border-collapse: collapse !important;
                margin-bottom: 15px !important;
                width: 100% !important;
                border: 1.5px solid #000000 !important;
              }

              .print-container th,
              .print-container td {
                border: 1px solid #000000 !important;
                padding: 5px 8px !important;
              }

              .print-container .bg-dark {
                background-color: #f8f9fa !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              .print-border {
                border: 1.5px solid #000000 !important;
              }

              .report-logo {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }

              h6 {
                margin-top: 15px !important;
                margin-bottom: 5px !important;
              }

              .signature-block {
                margin-top: 40px !important;
                page-break-inside: avoid !important;
              }
            }
          `,
        }}
      />

      <div className="card p-3 p-md-4 border-secondary shadow-sm bg-body text-body print-container">

        {/* REPORT TOOLBAR */}
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4 d-print-none">
          <div>
            <h5 className="text-info m-0 fw-bold">
              COLLECTIONS &amp; EXPENSES SUMMARY ({term})
            </h5>

            <small className="text-muted">
              Official financial statement for {organizationName}.
            </small>
          </div>

          <div>
            <button
              type="button"
              className="btn btn-outline-info btn-sm fw-bold me-2"
              onClick={() => setShowSettings(true)}
            >
              <i className="bi bi-gear-fill me-1" />
              Report Settings
            </button>

            <button
              type="button"
              className="btn btn-outline-secondary btn-sm fw-bold"
              onClick={() => window.print()}
            >
              <i className="bi bi-printer me-1" />
              Print Summary Report
            </button>
          </div>
        </div>

        {/* REPORT HEADER */}
        <div className="d-flex justify-content-between align-items-center gap-2 mb-3 pb-2 border-bottom border-dark border-opacity-50">

          {/* LEFT HEADER IMAGE */}
          <div
            className="text-center flex-shrink-0"
            style={{ width: "90px" }}
          >
            {!leftLogoFailed ? (
              <img
                className="report-logo"
                src={leftImageUrl}
                alt="Left report header image"
                onError={() => setLeftLogoFailed(true)}
                style={{
                  width: "100%",
                  maxHeight: "90px",
                  objectFit: "contain",
                }}
              />
            ) : (
              <div className="fw-bold text-info">
                CLEAR
                <div style={{ fontSize: "0.65rem" }}>SYSTEM</div>
              </div>
            )}
          </div>

          {/* SCHOOL NAME, ORGANIZATION NAME, AND ADDRESS */}
          <div className="text-center flex-grow-1 px-2">
            {reportSchoolHeading && (
              <div
                className="fw-bold text-uppercase"
                style={{ fontSize: "1.1rem" }}
              >
                {reportSchoolHeading}
              </div>
            )}

            <div
              className="fw-bold text-uppercase text-info"
              style={{
                fontSize: "0.9rem",
                letterSpacing: "0.5px",
              }}
            >
              {organizationName}
            </div>

            {reportAddress && (
              <div className="text-muted small">
                {reportAddress}
              </div>
            )}

            <div
              className="mt-3 fw-bold text-uppercase"
              style={{ fontSize: "0.95rem" }}
            >
              FINANCIAL REPORT OF CONTRIBUTIONS AND EXPENSES
            </div>

            <div className="text-muted small fst-italic mt-1">
              {ay} &nbsp;|&nbsp; {term}
            </div>
          </div>

          {/* RIGHT HEADER IMAGE */}
          <div
            className="text-center flex-shrink-0"
            style={{ width: "90px" }}
          >
            {rightImageUrl && !rightLogoFailed ? (
              <img
                className="report-logo"
                src={rightImageUrl}
                alt={`${organizationName} report image`}
                onError={() => setRightLogoFailed(true)}
                style={{
                  width: "100%",
                  maxHeight: "90px",
                  objectFit: "contain",
                }}
              />
            ) : (
              <div
                className="d-flex align-items-center justify-content-center rounded border border-secondary mx-auto fw-bold text-info"
                style={{
                  width: "68px",
                  height: "68px",
                  fontSize: "1.25rem",
                }}
                aria-label={`${organizationName} image placeholder`}
              >
                {organizationInitials || "ORG"}
              </div>
            )}
          </div>
        </div>

        {/* COLLECTIONS: aggregate by configured category; no item names, IDs or OR details. */}
        <h6 className="text-info text-uppercase fw-bold mt-2">Collections ({term})</h6>
        <div className="table-responsive mb-4">
          <table className="table table-sm table-bordered border-dark align-middle text-body mb-0" style={{ fontSize: "0.85rem" }}>
            <thead><tr className="text-muted"><th>Collection Category</th><th className="text-end"># Students</th><th className="text-end">Total Collected</th></tr></thead>
            <tbody>
              {summaryCategories.length === 0 ? (
                <tr><td colSpan={3} className="text-muted text-center">No collections recorded this term.</td></tr>
              ) : summaryCategories.map(row => (
                <tr key={row.category}><td className="ps-3">{row.category}</td><td className="text-end">{row.count}</td><td className="text-end">{fmt(row.total)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr className="fw-bold bg-dark text-white"><td colSpan={2} className="text-end">TOTAL COLLECTIONS:</td><td className="text-end text-info">{fmt(grandCollectionTotal || 0)}</td></tr></tfoot>
          </table>
        </div>

        {/* EXPENSES */}
        <h6 className="text-danger text-uppercase fw-bold mt-3">
          Expenses ({term})
        </h6>

        <div className="table-responsive mb-4">
          <table
            className="table table-sm table-bordered border-dark align-middle text-body mb-0"
            style={{ fontSize: "0.85rem" }}
          >
            <thead>
              <tr className="text-muted">
                <th>Fund Source Account</th>
                <th style={{ width: "15%" }} />
                <th style={{ width: "15%" }} />
                <th className="text-end" style={{ width: "20%" }}>
                  Total Amount
                </th>
              </tr>
            </thead>

            <tbody>
              {Object.keys(safeExpenses).length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-muted py-2">
                    No liquidated expenses recorded for this term.
                  </td>
                </tr>
              ) : (
                Object.entries(safeExpenses)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([fundName, totalAmount]) => (
                    <tr key={fundName}>
                      <td className="ps-3 fw-bold">{fundName}</td>
                      <td />
                      <td />
                      <td className="text-end text-danger">
                        {fmt(totalAmount || 0)}
                      </td>
                    </tr>
                  ))
              )}
            </tbody>

            <tfoot>
              <tr className="fw-bold bg-dark text-white">
                <td colSpan={3} className="text-end py-1">
                  SUB TOTAL:
                </td>
                <td className="text-end text-danger">
                  {fmt(grandExpenseTotal || 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Outstanding liabilities only: never mix collectible balances with collected income. */}
        <h6 className="text-warning text-uppercase fw-bold mt-3">Outstanding Student Obligations ({term})</h6>
        <p className="small text-muted fst-italic mb-1">These amounts are unpaid balances, not cash receipts. Counts are distinct students for penalties, and outstanding assessments for dues.</p>
        <div className="table-responsive mb-4">
          <table className="table table-sm table-bordered border-dark align-middle text-body mb-0" style={{ fontSize: "0.85rem" }}>
            <thead><tr className="text-muted"><th>Obligation Category</th><th className="text-end">Students / Assessments</th><th className="text-end">Outstanding Amount</th></tr></thead>
            <tbody>
              <tr><td className="ps-3">Penalty</td><td className="text-end">{penaltySummary.count}</td><td className="text-end">{fmt(penaltySummary.amount)}</td></tr>
              <tr><td className="ps-3">Dues / Collectibles</td><td className="text-end">{duesSummary.count}</td><td className="text-end">{fmt(duesSummary.amount)}</td></tr>
            </tbody>
            <tfoot><tr className="fw-bold bg-dark text-white"><td colSpan={2} className="text-end">TOTAL OUTSTANDING:</td><td className="text-end text-warning">{fmt((penaltySummary.amount || 0) + (duesSummary.amount || 0))}</td></tr></tfoot>
          </table>
        </div>

        {/* NET TREASURY BALANCE */}
        <div className="card p-2 d-flex flex-row justify-content-between align-items-center flex-wrap gap-2 mb-4 bg-body-secondary border-dark print-border rounded-0">
          <div>
            <span className="fw-bold text-uppercase text-body">
              NET TREASURY BALANCE (NET ENDING POSITION):
            </span>

            <div className="text-muted small" style={{ fontSize: "0.75rem" }}>
              Total Dynamic Balance (including initial funds, rollovers &amp; advances)
            </div>
          </div>

          <div
            className={`fs-5 fw-bold ${
              netBalance >= 0 ? "text-success" : "text-danger"
            }`}
          >
            {fmt(netBalance)}
          </div>
        </div>

        {/* FUND LOCATION / SAFEKEEPING */}
        <div className="card p-3 mb-4 bg-transparent border-dark text-body rounded-0 print-border">
          <h6 className="fw-bold text-uppercase mb-3">
            <i className="bi bi-safe2 me-2" />
            Fund Location / Safekeeping Status
          </h6>

          <div className="d-flex justify-content-between small mb-1">
            <span>Total Physically Deposited to Univ. Cashier:</span>
            <span className="fw-semibold text-success">
              {fmt(totalDeposited || 0)}
            </span>
          </div>

          <div className="d-flex justify-content-between small mb-1">
            <span>Total Physically Withdrawn:</span>
            <span className="fw-semibold text-danger">
              ({fmt(totalWithdrawn || 0)})
            </span>
          </div>

          <hr className="border-dark my-2 opacity-25" />

          <div className="d-flex justify-content-between fw-bold">
            <span>CURRENT BALANCE IN SAFEKEEPING:</span>
            <span className="text-info">{fmt(safeBalance)}</span>
          </div>

          <div className="d-flex justify-content-between fw-bold mt-2 pt-2 border-top border-dark text-dark">
            <span>
              PHYSICAL CASH ON HAND{" "}
              <span className="fw-normal">
                (Net Balance minus Safekeeping)
              </span>
              :
            </span>
            <span>{fmt(netBalance - safeBalance)}</span>
          </div>
        </div>

        {/* SIGNATURE BLOCKS */}
        <div
          className="row mt-5 pt-3 text-body signature-block"
          style={{ fontSize: "0.85rem" }}
        >
          {signatories.length > 0 ? (
            signatories.map((signatory, index) => (
              <div
                className="col text-center"
                key={signatory.id || index}
              >
                <div
                  className="fw-bold text-uppercase text-muted mb-1"
                  style={{ fontSize: "0.75rem" }}
                >
                  {signatory.label}
                </div>

                <div style={{ height: "40px" }} />

                <div className="fw-bold border-top border-dark pt-1 d-inline-block px-3">
                  {signatory.name || "________________"}
                </div>

                <div
                  className="text-muted mt-1"
                  style={{ fontSize: "0.7rem" }}
                >
                  {signatory.position || "Position"}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-muted small w-100">
              <em>
                No signatories configured. Click &quot;Report Settings&quot; to add them.
              </em>
            </div>
          )}
        </div>

        {/* The former "cc: VPAA, VPF, OSA" footer is intentionally removed. */}
      </div>

      {/* REPORT SETTINGS MODAL */}
      {showSettings && (
        <div
          className="modal fade show d-block d-print-none"
          tabIndex={-1}
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
        >
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content bg-body border-secondary text-body shadow-lg">

              <div className="modal-header border-secondary">
                <h5 className="modal-title fw-bold text-info">
                  <i className="bi bi-gear-fill me-2" />
                  Report Settings
                </h5>

                <button
                  type="button"
                  className="btn-close"
                  onClick={handleCancelSettings}
                  aria-label="Close report settings"
                />
              </div>

              <div className="modal-body p-4">

                {/* SCHOOL NAME AND ADDRESS */}
                <h6 className="fw-bold text-info mb-3">
                  <i className="bi bi-card-heading me-2" />
                  Report Header
                </h6>

                <p className="small text-muted mb-3">
                  Set the school name and address shown above the
                  College, Department, or Organization Name. That
                  organization name is read directly from the Organization
                  record and is not editable here.
                </p>

                <div className="row g-3 mb-4">
                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold">
                      School Name
                    </label>

                    <input
                      type="text"
                      className="form-control form-control-sm bg-body text-body border-secondary"
                      maxLength={200}
                      value={schoolNameDraft}
                      onChange={(event) =>
                        setSchoolNameDraft(event.target.value)
                      }
                      placeholder="e.g. Filamer Christian University"
                      required
                    />
                  </div>

                  <div className="col-12 col-md-6">
                    <label className="form-label small fw-semibold">
                      College / Department / Organization Name
                    </label>

                    <input
                      type="text"
                      className="form-control form-control-sm bg-body-secondary text-body border-secondary"
                      value={organizationName}
                      readOnly
                    />

                    <small className="text-muted">
                      This name comes from the Organization record.
                    </small>
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-semibold">
                      School Address
                    </label>

                    <input
                      type="text"
                      className="form-control form-control-sm bg-body text-body border-secondary"
                      maxLength={300}
                      value={schoolAddressDraft}
                      onChange={(event) =>
                        setSchoolAddressDraft(event.target.value)
                      }
                      placeholder="e.g. Roxas Avenue, Roxas City"
                    />

                    <small className="text-muted">
                      Leave blank to omit the address from the report.
                    </small>
                  </div>

                  {/* LEFT HEADER IMAGE */}
                  <div className="col-12 col-md-6">
                    <div className="card border-secondary p-3 h-100">
                      <label className="form-label fw-semibold">
                        Left Header Image
                      </label>

                      <div className="d-flex align-items-center gap-3 mb-3">
                        {!leftLogoFailed ? (
                          <img
                            src={leftImageUrl}
                            alt="Current left header image"
                            onError={() => setLeftLogoFailed(true)}
                            style={{
                              width: "80px",
                              height: "80px",
                              objectFit: "contain",
                            }}
                          />
                        ) : (
                          <div className="fw-bold text-info">
                            CLEAR
                          </div>
                        )}

                        <div className="small text-muted">
                          {leftLogoFile
                            ? `Selected: ${leftLogoFile.name}`
                            : reportHeaderLeftLogo
                              ? "Saved custom left image"
                              : "Default CLEAR System image"}
                        </div>
                      </div>

                      <input
                        key={leftLogoInputKey}
                        type="file"
                        className="form-control form-control-sm bg-body text-body border-secondary"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) =>
                          setLeftLogoFile(
                            event.target.files?.[0] || null
                          )
                        }
                      />

                      <small className="text-muted mt-2">
                        PNG, JPEG, or WebP; maximum 5 MB.
                      </small>
                    </div>
                  </div>

                  {/* RIGHT HEADER IMAGE */}
                  <div className="col-12 col-md-6">
                    <div className="card border-secondary p-3 h-100">
                      <label className="form-label fw-semibold">
                        Right Header Image
                      </label>

                      <div className="d-flex align-items-center gap-3 mb-3">
                        {rightImageUrl && !rightLogoFailed ? (
                          <img
                            src={rightImageUrl}
                            alt="Current right header image"
                            onError={() => setRightLogoFailed(true)}
                            style={{
                              width: "80px",
                              height: "80px",
                              objectFit: "contain",
                            }}
                          />
                        ) : (
                          <div
                            className="d-flex align-items-center justify-content-center border border-secondary rounded fw-bold text-info"
                            style={{
                              width: "80px",
                              height: "80px",
                            }}
                          >
                            {organizationInitials || "ORG"}
                          </div>
                        )}

                        <div className="small text-muted">
                          {rightLogoFile
                            ? `Selected: ${rightLogoFile.name}`
                            : reportHeaderRightLogo
                              ? "Saved custom right image"
                              : logoUrl
                                ? "Using the organization's logo"
                                : "No right image configured"}
                        </div>
                      </div>

                      <input
                        key={rightLogoInputKey}
                        type="file"
                        className="form-control form-control-sm bg-body text-body border-secondary"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) =>
                          setRightLogoFile(
                            event.target.files?.[0] || null
                          )
                        }
                      />

                      <small className="text-muted mt-2">
                        PNG, JPEG, or WebP; maximum 5 MB.
                      </small>
                    </div>
                  </div>

                  <div className="col-12 d-flex justify-content-end">
                    <button
                      type="button"
                      className="btn btn-info btn-sm text-dark fw-bold"
                      onClick={handleSaveHeaderSettings}
                      disabled={
                        isSavingHeader || isSavingSignatories
                      }
                    >
                      <i className="bi bi-check2-circle me-1" />
                      {isSavingHeader
                        ? "Saving Header..."
                        : "Save Header Settings"}
                    </button>
                  </div>
                </div>

                <hr className="border-secondary" />

                {/* SIGNATORIES */}
                <h6 className="fw-bold text-info mb-3">
                  <i className="bi bi-pen-fill me-2" />
                  Report Signatories
                </h6>

                <p className="small text-muted mb-3">
                  Customize the signatories printed at the bottom of
                  the Summary and Liquidation reports.
                </p>

                {signatories.map((signatory, index) => (
                  <div
                    key={signatory.id || index}
                    className="row g-2 mb-3 align-items-center bg-body-secondary p-2 rounded border border-secondary"
                  >
                    <div className="col-12 col-md-3">
                      <label className="form-label small fw-semibold text-muted mb-1">
                        Action / Label
                      </label>

                      <select
                        className="form-select form-select-sm bg-body text-body border-secondary"
                        value={signatory.label}
                        onChange={(event) =>
                          handleUpdateSignatory(
                            index,
                            "label",
                            event.target.value
                          )
                        }
                      >
                        {labelOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold text-muted mb-1">
                        Full Name
                      </label>

                      <input
                        type="text"
                        className="form-control form-control-sm bg-body text-body border-secondary"
                        placeholder="Full name"
                        value={signatory.name}
                        onChange={(event) =>
                          handleUpdateSignatory(
                            index,
                            "name",
                            event.target.value
                          )
                        }
                      />
                    </div>

                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold text-muted mb-1">
                        Position / Title
                      </label>

                      <input
                        type="text"
                        className="form-control form-control-sm bg-body text-body border-secondary"
                        placeholder="Position / title"
                        value={signatory.position}
                        onChange={(event) =>
                          handleUpdateSignatory(
                            index,
                            "position",
                            event.target.value
                          )
                        }
                      />
                    </div>

                    <div className="col-12 col-md-1 text-end">
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => handleRemoveSignatory(index)}
                        title="Remove signatory"
                        aria-label={`Remove signatory ${index + 1}`}
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm w-100 fw-bold border-dashed mt-2"
                  onClick={handleAddSignatory}
                >
                  <i className="bi bi-plus-lg me-1" />
                  Add Signatory
                </button>

                <div className="d-flex justify-content-end mt-3">
                  <button
                    type="button"
                    className="btn btn-info btn-sm text-dark fw-bold"
                    onClick={handleSaveSignatories}
                    disabled={
                      isSavingSignatories || isSavingHeader
                    }
                  >
                    <i className="bi bi-check2-circle me-1" />
                    {isSavingSignatories
                      ? "Saving Signatories..."
                      : "Save Signatories"}
                  </button>
                </div>
              </div>

              <div className="modal-footer border-secondary">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCancelSettings}
                  disabled={
                    isSavingHeader || isSavingSignatories
                  }
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
