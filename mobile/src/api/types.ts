// Shapes of the mobile REST API (Phase 2, app/api/mobile/** in the web app).
// Money is integer centavos.

export type Organization = {
  subdomain: string;
  name: string;
  type: 'Department' | 'Organization';
  logoUrl: string | null;
  activeAy: string;
  /** A free-form term label; see `TermLabel`. */
  activeTerm: string;
  /** Newer servers, GET /orgs/:org only: the active term was closed on the web (no new payments). */
  periodClosed?: boolean;
};

/**
 * Term labels the web app uses. Schools run semesters, trimesters or a full
 * year, so treat a term as an opaque label: never parse or count it.
 */
export type TermLabel =
  | '1st Sem' | '2nd Sem' | 'Summer'
  | '1st Trimester' | '2nd Trimester' | '3rd Trimester'
  | 'Full Year'
  | (string & {});

/** Tenant database role. Labels are preserved; a tenant 'superadmin' is NOT global. */
export type Role = 'admin' | 'administrator' | 'master' | 'treasurer' | 'auditor' | 'viewer' | 'superadmin' | (string & {});

export type Officer = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  /** Explicit tenant scope, never a global-administrator authorization grant. */
  scope?: 'department';
  /** Effective permission tab IDs (admins get all), as in lib/permissions.ts. */
  allowedTabs: string[];
};

/** A bearer token bound to one officer in one org; lasts 7 days. */
export type Session = { token: string; officer: Officer; org: Organization; expiresAt: string };

/** Global administrators are not department officers and have no implicit tenant permissions. */
export type GlobalAdmin = { id: string; fullName: string; email: string; role: 'SuperAdmin' };
export type GlobalSession = { token: string; admin: GlobalAdmin; expiresAt: string };
export type GlobalOverview = {
  generatedAt: string;
  organizations: Array<{
    subdomain: string;
    name: string;
    type: string;
    status: string;
    activeAy: string;
    activeTerm: string;
    studentsCount: number;
    officersCount: number;
    activeRoles?: Array<{ role: string; count: number }>;
  }>;
  globalAdmins: { active: number; pending: number };
};

export type SubscriptionTier = 'Freemium' | 'Pro' | 'Corporate';
export type OrganizationStatus = 'Active' | 'Inactive' | 'Archived';
export type CalendarMode = 'Semester' | 'Trimester' | 'FullYear';
export type ManagedTenant = {
  id: string;
  subdomain: string;
  name: string;
  schoolGroup: string;
  tier: SubscriptionTier;
  status: OrganizationStatus;
  type: 'Department' | 'Organization';
  activeAy: string;
  activeTerm: string;
  createdAt: string;
  studentsCount: number;
  collectionsCount: number;
  officersCount: number;
};
export type NewTenant = {
  name: string;
  subdomain: string;
  schoolGroup: string;
  tier: SubscriptionTier;
  type: 'Department' | 'Organization';
  initialAcademicYear: string;
  calendarMode: CalendarMode;
  includeSummer: boolean;
  adminName: string;
  adminEmail: string;
  adminUsername?: string;
  confirmation: string;
};
export type ProvisionResult = {
  success: boolean;
  organizationId: string;
  department: string;
  academicYear: string;
  activeTerm: string;
  message: string;
};

/** Global superadmin tenant view: never an officer session or mutation grant. */
export type GlobalTenantDashboard = {
  organization: Organization & { status: string };
  dashboard: DashboardSummary;
};

export type ClearanceResult = {
  /** Hidden on anonymous public lookups; present for authorized officers. */
  studentName: string | null;
  studentId: string | null;
  status: 'cleared' | 'hold';
  /** null on public lookups (cleared/on hold only); filled for an officer token with tab-clearance. */
  outstandingCentavos: number | null;
  /** The absolute, signed verification URL the web checks live. Encode as-is in the QR. */
  qrToken: string | null;
  ay: string;
  term: TermLabel;
  /**
   * Newer servers: what is still unpaid, including arrears from earlier terms.
   * Officer tokens with tab-clearance only; null on public lookups.
   */
  unpaidItems?: UnpaidItem[] | null;
};

/** One unpaid fee or penalty behind an on-hold clearance. */
export type UnpaidItem = {
  label: string;
  amount: number; // centavos
  /** Set for arrears from an earlier period, e.g. `A.Y. 2025 - 2026`. */
  academicYear?: string;
  term?: string;
  /** The fee category, or 'Penalty'. Display only. */
  kind?: string;
};

export type LedgerEntry = {
  /** Database id; for online remittances, the id the remittance endpoints take. */
  id: string;
  kind: 'collection' | 'online-remittance' | 'penalty' | 'advance' | 'cashier-remittance';
  title: string;
  reference: string;
  subtitle: string;
  amountCentavos: number;
  status: string;
  at: string;
};

export type RemittanceDetail = LedgerEntry & {
  studentId: string;
  studentEmail: string | null;
  paymentChannel: string;
  itemDescription: string;
  /** data:image/...;base64 URL, shown directly in an Image. */
  proofDataUrl: string | null;
  reviewNotes: string | null;
  reviewedBy: string | null;
};

export type DashboardSummary = {
  ay: string;
  term: string;
  cashOnHandCentavos: number;
  safekeepingCentavos: number;
  pendingCentavos: number;
  pendingCount: number;
  outstandingCentavos: number;
  outstandingStudents: number;
  collectionsToday: number;
};

export type Student = {
  id: string;
  studentId: string;
  fullName: string;
  yearLevel: string;
  /** Ken's web app calls a dropped student "Inactive"; older servers send 'Dropped'. Show via `enrollmentLabel`. */
  enrollmentStatus: 'Enrolled' | 'Dropped' | 'Inactive';
};

export type FeeItem = { id: string; category: string; name: string; amountCentavos: number; targetFund: string };

export type ProofFile = { uri: string; name: string; mimeType: string };

/** Student name and email come from the roster; the app sends only the school ID. */
export type ProofSubmission = {
  studentId: string;
  paymentChannel: 'GCash' | 'Maya' | 'Bank transfer';
  referenceNumber: string;
  amountCentavos: number;
  itemDescription: string;
  file: ProofFile;
};

export type ErrorCode =
  | 'invalid' | 'unauthorized' | 'forbidden' | 'not_found' | 'conflict'
  | 'duplicate_or' | 'payload_too_large' | 'invalid_student' | 'invalid_code'
  | 'period_closed' | 'overpayment' | 'rate_limited'
  | 'server_error' | 'network';

export class ApiError extends Error {
  constructor(message: string, public code: ErrorCode | string, public status = 0) {
    super(message);
  }
}

/** Everything screens can ask of the backend. The HTTP client and the mock both implement it. */
export type ClearApi = {
  mode: 'http' | 'mock';
  // public
  listOrganizations(): Promise<Organization[]>;
  getOrganization(org: string): Promise<Organization>;
  lookupClearance(org: string, query: string, session?: Session | null): Promise<ClearanceResult>;
  listFeeItems(org: string): Promise<FeeItem[]>;
  submitProof(org: string, p: ProofSubmission): Promise<{ submissionId: string }>;
  // sign-in
  /** Same reply whether or not the email is an officer's (no account probing). */
  requestCode(org: string, email: string): Promise<{ sentTo: string; message?: string }>;
  verifyCode(org: string, email: string, code: string): Promise<Session>;
  /** Re-validates a stored token; throws ApiError('unauthorized') when it is no longer good. */
  restoreSession(org: string, token: string): Promise<Session>;
  signOut(session: Session): Promise<void>;
  // global superadmin — separate OTP policy, session and read-only overview.
  requestGlobalCode(email: string): Promise<{ message: string }>;
  verifyGlobalCode(email: string, code: string): Promise<GlobalSession>;
  restoreGlobalSession(token: string): Promise<GlobalSession>;
  signOutGlobal(session: GlobalSession): Promise<void>;
  getGlobalOverview(session: GlobalSession): Promise<GlobalOverview>;
  listManagedTenants(session: GlobalSession): Promise<ManagedTenant[]>;
  provisionTenant(session: GlobalSession, payload: NewTenant): Promise<ProvisionResult>;
  manageTenant(session: GlobalSession, payload: {
    organizationId: string; action: 'status' | 'tier' | 'group'; value: string; confirmation: string;
  }): Promise<{ success: boolean; organization: string }>;
  /** Read-only across ALL tenants, including inactive or archived, as on web. */
  getGlobalTenantDashboard(session: GlobalSession, slug: string): Promise<GlobalTenantDashboard>;
  listGlobalTenantStudents(session: GlobalSession, slug: string, q?: string): Promise<Student[]>;
  listGlobalTenantLedger(session: GlobalSession, slug: string): Promise<LedgerEntry[]>;
  listGlobalTenantRemittances(session: GlobalSession, slug: string): Promise<LedgerEntry[]>;
  // officer
  getDashboard(s: Session): Promise<DashboardSummary>;
  listLedger(s: Session, filter?: { status?: string; limit?: number }): Promise<LedgerEntry[]>;
  /** Accessible to tab-remittances even without tab-overview. */
  listPendingRemittances(s: Session): Promise<LedgerEntry[]>;
  listStudents(s: Session, q?: string): Promise<Student[]>;
  recordPayment(s: Session, p: { studentId: string; feeId: string; amountCentavos: number; orNumber: string; idempotencyKey?: string }): Promise<LedgerEntry>;
  getRemittance(s: Session, id: string): Promise<RemittanceDetail>;
  verifyRemittance(s: Session, id: string, p: { orNumber: string; fundAllocation?: string }): Promise<{ orNumber: string }>;
  invalidateRemittance(s: Session, id: string): Promise<{ ok: true }>;
};
