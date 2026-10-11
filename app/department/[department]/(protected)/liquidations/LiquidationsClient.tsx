// (protected)/liquidations/LiquidationsClient.tsx

"use client";

import { useState } from "react";
import LiquidationsForm from "./LiquidationsForm";
import LiquidationHistory from "./LiquidationHistory";

export default function LiquidationsClient({
  department,
  orgName,
  logoUrl,
  signatories,
  ay,
  term,
  pendingAdvances,
  funds,
  prefillCaId,
  pastAudits,
}: any) {
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

  return (
    <div>
      {/* TABS HEADER */}
      <div className="card-header bg-body border-bottom border-secondary pt-3 px-3 px-md-4 d-print-none">
        <ul className="nav nav-tabs border-bottom-0" role="tablist">
          <li className="nav-item" role="presentation">
            <button
              className={`nav-link fw-bold ${activeTab === "pending" ? "active text-info border-secondary border-bottom-0 bg-body" : "text-muted border-transparent bg-transparent"}`}
              onClick={() => setActiveTab("pending")}
              type="button"
            >
              <i className="bi bi-file-earmark-text me-2"></i>
              Pending Advances & Audit Form
            </button>
          </li>
          <li className="nav-item" role="presentation">
            <button
              className={`nav-link fw-bold ${activeTab === "history" ? "active text-info border-secondary border-bottom-0 bg-body" : "text-muted border-transparent bg-transparent"}`}
              onClick={() => setActiveTab("history")}
              type="button"
            >
              <i className="bi bi-clock-history me-2"></i>
              Audited Liquidation History
            </button>
          </li>
        </ul>
      </div>

      {/* TABS CONTENT */}
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
            />
          </div>
        ) : (
          <div className="p-3 p-md-4">
            <LiquidationHistory
              audits={pastAudits}
              orgName={orgName}
              logoUrl={logoUrl}
              signatories={signatories}
              ay={ay}
              term={term}
            />
          </div>
        )}
      </div>
    </div>
  );
}