-- Additive schedule enforcement. All historical notices default to announcement-only.
-- No current MaintenancePolicy, notice, financial or tenant data is modified.
ALTER TABLE "MaintenanceNotice" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'NORMAL';
ALTER TABLE "MaintenanceNotice" ADD CONSTRAINT "MaintenanceNotice_mode_check"
  CHECK ("mode" IN ('NORMAL', 'READ_ONLY', 'FULL'));
CREATE INDEX "MaintenanceNotice_active_mode_window_idx"
  ON "MaintenanceNotice" ("scopeKey", "state", "mode", "startsAt", "endsAt");
