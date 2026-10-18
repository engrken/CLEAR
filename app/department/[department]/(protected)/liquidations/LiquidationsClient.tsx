// /app/department/[department]/(protected)/liquidations/LiquidationsClient.tsx
"use client";
import { clearAlert, clearConfirm, clearPrompt } from "@/lib/clear-dialogs";


import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveReportSettings, saveSignatories } from "../../actions";
import LiquidationsForm from "./LiquidationsForm";
import LiquidationHistory from "./LiquidationHistory";

type Signatory = {
  id?: string;
  label: string;
  name: string;
  position: string;
  order?: number;
};

type LiquidationsClientProps = {
  orgId: string;
  department: string;
  orgName: string;
  logoUrl?: string | null;
  signatories?: Signatory[];
  ay: string;
  term: string;
  pendingAdvances?: any[];
  funds?: any[];
  prefillCaId?: string;
  pastAudits?: any[];
  isClosed?: boolean;
  canVoid?: boolean;
  reportSchoolName?: string | null;
  reportSchoolAddress?: string | null;
  reportHeaderLeftLogo?: string | null;
  reportHeaderRightLogo?: string | null;
};

const LABEL_OPTIONS = [
  "Prepared by:",
  "Attested by:",
  "Noted by:",
  "Endorsed by:",
  "Verified by:",
  "Approved by:",
];

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export default function LiquidationsClient({
  orgId,
  department,
  orgName,
  logoUrl,
  signatories: initialSignatories = [],
  ay,
  term,
  pendingAdvances = [],
  funds = [],
  prefillCaId = "",
  pastAudits = [],
  isClosed = false,
  canVoid = false,
  reportSchoolName = "",
  reportSchoolAddress = "",
  reportHeaderLeftLogo = "",
  reportHeaderRightLogo = "",
}: LiquidationsClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [showSettings, setShowSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Saved values are used in the print preview. Draft values are only used in the modal.
  const [savedSchoolName, setSavedSchoolName] = useState(reportSchoolName || "");
  const [savedSchoolAddress, setSavedSchoolAddress] = useState(reportSchoolAddress || "");
  const [savedSignatories, setSavedSignatories] = useState<Signatory[]>(initialSignatories);

  const [schoolName, setSchoolName] = useState(reportSchoolName || "");
  const [schoolAddress, setSchoolAddress] = useState(reportSchoolAddress || "");
  const [signatories, setSignatories] = useState<Signatory[]>(initialSignatories);
  const [leftLogoFile, setLeftLogoFile] = useState<File | null>(null);
  const [rightLogoFile, setRightLogoFile] = useState<File | null>(null);
  const [fileInputVersion, setFileInputVersion] = useState(0);

  // Refresh local print and form values when the parent server page receives new DB data.
  useEffect(() => {
    setSavedSchoolName(reportSchoolName || "");
    setSavedSchoolAddress(reportSchoolAddress || "");
    setSavedSignatories(initialSignatories);
    if (!showSettings) {
      setSchoolName(reportSchoolName || "");
      setSchoolAddress(reportSchoolAddress || "");
      setSignatories(initialSignatories);
    }
    // Only synchronize when data from the server changes; modal toggles must not reset edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportSchoolName, reportSchoolAddress, initialSignatories]);

  const resetFiles = () => {
    setLeftLogoFile(null);
    setRightLogoFile(null);
    setFileInputVersion((version) => version + 1);
  };

  const openSettings = () => {
    setSchoolName(savedSchoolName);
    setSchoolAddress(savedSchoolAddress);
    setSignatories(savedSignatories.map((signatory) => ({ ...signatory })));
    resetFiles();
    setShowSettings(true);
  };

  const cancelSettings = () => {
    if (isSaving) return;
    setShowSettings(false);
    setSchoolName(savedSchoolName);
    setSchoolAddress(savedSchoolAddress);
    setSignatories(savedSignatories.map((signatory) => ({ ...signatory })));
    resetFiles();
  };

  const handleAddSignatory = () => {
    setSignatories((current) => [
      ...current,
      { label: "Prepared by:", name: "", position: "" },
    ]);
  };

  const handleUpdateSignatory = (
    index: number,
    field: "label" | "name" | "position",
    value: string
  ) => {
    setSignatories((current) =>
      current.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry))
    );
  };

  const handleRemoveSignatory = (index: number) => {
    setSignatories((current) => current.filter((_, i) => i !== index));
  };

  const validateLogo = (file: File | undefined): File | null => {
    if (!file) return null;
    if (!LOGO_TYPES.includes(file.type)) {
      void clearAlert("Please choose a PNG, JPEG, or WebP image for the report logo.");
      return null;
    }
    if (file.size > MAX_LOGO_BYTES) {
      void clearAlert("Each report logo must be 5 MB or smaller.");
      return null;
    }
    return file;
  };

  const handleSaveReportSettings = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("schoolName", schoolName.trim());
      formData.append("schoolAddress", schoolAddress.trim());
      if (leftLogoFile) formData.append("leftLogo", leftLogoFile);
      if (rightLogoFile) formData.append("rightLogo", rightLogoFile);

      // Keep the same server actions used by the Summary and Reports pages.
      await saveReportSettings(department, formData);
      await saveSignatories(orgId, department, signatories);

      setSavedSchoolName(schoolName.trim());
      setSavedSchoolAddress(schoolAddress.trim());
      setSavedSignatories(signatories.map((entry) => ({ ...entry })));
      resetFiles();
      setShowSettings(false);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      void clearAlert(`Failed to save report settings: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      {/* LIQUIDATIONS TABS AND SHARED REPORT SETTINGS */}
      <div className="card-header bg-body border-bottom border-secondary pt-3 px-3 px-md-4 d-print-none d-flex justify-content-between align-items-end flex-wrap gap-2">
        <ul className="nav nav-tabs border-bottom-0" role="tablist">
          <li className="nav-item" role="presentation">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "pending"}
              className={`nav-link fw-bold ${activeTab === "pending" ? "active text-info border-secondary border-bottom-0 bg-body" : "text-muted border-transparent bg-transparent"}`}
              onClick={() => setActiveTab("pending")}
            >
              <i className="bi bi-file-earmark-text me-2" />
              Pending Advances &amp; Audit Form
            </button>
          </li>
          <li className="nav-item" role="presentation">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "history"}
              className={`nav-link fw-bold ${activeTab === "history" ? "active text-info border-secondary border-bottom-0 bg-body" : "text-muted border-transparent bg-transparent"}`}
              onClick={() => setActiveTab("history")}
            >
              <i className="bi bi-clock-history me-2" />
              Audited Liquidation History
            </button>
          </li>
        </ul>
        <button
          type="button"
          className="btn btn-outline-info btn-sm fw-bold mb-2"
          onClick={openSettings}
        >
          <i className="bi bi-gear-fill me-1" />
          Report Settings
        </button>
      </div>

      {/* TAB CONTENT */}
      <div className="card-body p-0 bg-body">
        {activeTab === "pending" ? (
          <div className="p-3 p-md-4">
            <LiquidationsForm
              department={department}
              ay={ay}
              term={term}
              pendingAdvances={pendingAdvances}
              funds={funds}
              prefillCaId={prefillCaId}
              isClosed={isClosed}
            />
          </div>
        ) : (
          <div className="p-3 p-md-4">
            <LiquidationHistory
              audits={pastAudits}
              orgName={orgName}
              logoUrl={logoUrl}
              signatories={savedSignatories}
              ay={ay}
              term={term}
              department={department}
              orgId={orgId}
              reportSchoolName={savedSchoolName}
              reportSchoolAddress={savedSchoolAddress}
              reportHeaderLeftLogo={reportHeaderLeftLogo || ""}
              reportHeaderRightLogo={reportHeaderRightLogo || ""}
              settingsManagedByParent={true}
              canVoid={canVoid}
              isClosed={isClosed}
            />
          </div>
        )}
      </div>

      {/* SHARED REPORT SETTINGS MODAL */}
      {showSettings && (
        <div
          className="modal fade show d-block d-print-none"
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="Report Settings"
          style={{ backgroundColor: "rgba(0,0,0,0.6)", zIndex: 1080 }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
            <div className="modal-content bg-body border-secondary text-body shadow-lg clear-theme-modal">
              <div className="modal-header border-secondary">
                <h5 className="modal-title fw-bold text-info">
                  <i className="bi bi-gear-fill me-2" />
                  Report Settings
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={cancelSettings}
                  disabled={isSaving}
                  aria-label="Close"
                />
              </div>

              <div className="modal-body p-4">
                <p className="small text-muted mb-3">
                  School branding is shared by the Summary, Reports, and Audited
                  Liquidation History printouts. The registered organization name
                  remains unchanged.
                </p>

                <div className="border border-secondary rounded p-3 mb-4">
                  <h6 className="fw-bold text-info mb-3">Institution / Print Header</h6>
                  <div className="mb-3">
                    <label htmlFor="liq-school-name" className="form-label small fw-semibold">
                      School Name
                    </label>
                    <input
                      id="liq-school-name"
                      type="text"
                      className="form-control bg-body text-body border-secondary"
                      placeholder="Enter school or institution name"
                      value={schoolName}
                      onChange={(event) => setSchoolName(event.target.value)}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="liq-organization" className="form-label small fw-semibold">
                      Organization / Department Name
                    </label>
                    <input
                      id="liq-organization"
                      type="text"
                      className="form-control bg-body-secondary text-body border-secondary"
                      value={orgName}
                      readOnly
                    />
                    <div className="form-text">
                      This name comes from the registered organization and appears
                      below the school name in printed reports.
                    </div>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="liq-school-address" className="form-label small fw-semibold">
                      School Address
                    </label>
                    <textarea
                      id="liq-school-address"
                      className="form-control bg-body text-body border-secondary"
                      rows={2}
                      placeholder="Enter school address"
                      value={schoolAddress}
                      onChange={(event) => setSchoolAddress(event.target.value)}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label htmlFor="liq-left-logo" className="form-label small fw-semibold">
                        Left Header Logo
                      </label>
                      <input
                        key={`left-${fileInputVersion}`}
                        id="liq-left-logo"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="form-control form-control-sm bg-body text-body border-secondary"
                        onChange={(event) => {
                          const selected = validateLogo(event.target.files?.[0]);
                          setLeftLogoFile(selected);
                          if (!selected) event.target.value = "";
                        }}
                        disabled={isSaving}
                      />
                      {reportHeaderLeftLogo && (
                        <div className="small text-muted mt-1">
                          A left logo is saved. Upload a new image to replace it.
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="liq-right-logo" className="form-label small fw-semibold">
                        Right Header Logo
                      </label>
                      <input
                        key={`right-${fileInputVersion}`}
                        id="liq-right-logo"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="form-control form-control-sm bg-body text-body border-secondary"
                        onChange={(event) => {
                          const selected = validateLogo(event.target.files?.[0]);
                          setRightLogoFile(selected);
                          if (!selected) event.target.value = "";
                        }}
                        disabled={isSaving}
                      />
                      {(reportHeaderRightLogo || logoUrl) && (
                        <div className="small text-muted mt-1">
                          A right logo is available. Upload a new image to replace it.
                        </div>
                      )}
                    </div>
                    <div className="col-12">
                      <small className="text-muted">PNG, JPEG, or WebP; maximum 5 MB per logo.</small>
                    </div>
                  </div>
                </div>

                <h6 className="fw-bold text-info mb-3">Report Signatories</h6>
                {signatories.map((signatory, index) => (
                  <div
                    key={signatory.id || index}
                    className="row g-2 mb-3 align-items-center bg-body-secondary p-2 rounded border border-secondary"
                  >
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold text-muted mb-1">Action / Label</label>
                      <select
                        className="form-select form-select-sm bg-body text-body border-secondary"
                        value={signatory.label || "Prepared by:"}
                        onChange={(event) => handleUpdateSignatory(index, "label", event.target.value)}
                        disabled={isSaving}
                      >
                        {LABEL_OPTIONS.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold text-muted mb-1">Full Name</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-body text-body border-secondary"
                        placeholder="e.g. Juan Dela Cruz"
                        value={signatory.name || ""}
                        onChange={(event) => handleUpdateSignatory(index, "name", event.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold text-muted mb-1">Position / Title</label>
                      <input
                        type="text"
                        className="form-control form-control-sm bg-body text-body border-secondary"
                        placeholder="e.g. Internal Auditor"
                        value={signatory.position || ""}
                        onChange={(event) => handleUpdateSignatory(index, "position", event.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                    <div className="col-md-1 text-end mt-4">
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => handleRemoveSignatory(index)}
                        disabled={isSaving}
                        title="Remove signatory"
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm w-100 fw-bold mt-2"
                  onClick={handleAddSignatory}
                  disabled={isSaving}
                >
                  <i className="bi bi-plus-lg me-1" />
                  Add Signatory
                </button>
              </div>
              <div className="modal-footer border-secondary">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={cancelSettings}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-info btn-sm text-dark fw-bold"
                  onClick={handleSaveReportSettings}
                  disabled={isSaving}
                >
                  {isSaving ? "Saving..." : "Save Report Settings"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
