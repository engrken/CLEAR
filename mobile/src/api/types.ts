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
export type GlobalMaintenanceNotice = {
  id:string;scopeKey:string;mode:'NORMAL'|'READ_ONLY'|'FULL';
  state:'DRAFT'|'SCHEDULED'|'CANCELLED';
  title:string;message:string;startsAt:string;endsAt:string;version:number;
};
export type GlobalMaintenancePage={
  serverTime:string; notices:GlobalMaintenanceNotice[];
};
export type GlobalMaintenanceChange =
  | {action:'create';scope:string;mode:'NORMAL'|'READ_ONLY'|'FULL';title:string;
      message:string;startsAt:string;endsAt:string;confirmation:string}
  | {action:'end_early'|'cancel';id:string;expectedVersion:number;confirmation:string};
export type GlobalSession = { token: string; admin: GlobalAdmin; expiresAt: string };
export type GlobalOverview = {
  generatedAt: string;
  organizations: {
    subdomain: string;
    name: string;
    type: string;
    status: string;
    activeAy: string;
    activeTerm: string;
    studentsCount: number;
    officersCount: number;
    activeRoles?: { role: string; count: number }[];
  }[];
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

/** Live, tenant-scoped metadata for an authenticated administrator only. */
export type TenantUserRecord = {
  id: string; fullName: string; email: string; username: string;
  role: string; status: 'Active' | 'Inactive' | 'Blocked'; updatedAt: string;
  allowedTabs: string[];
};
export type TenantUsersPage = { records: TenantUserRecord[]; hasMore: boolean; nextCursor: string | null;
  rolePresets?: Record<string, string[]> };
export type CollectibleRecord = {
  id: string; category: string; headcount: number;
  status: string; balanceCentavos: number;
};
export type CollectiblePage = { scope: 'active_period'; ay: string; term: string;
  records: CollectibleRecord[]; hasMore: boolean; nextCursor: string | null };

export type TenantUserManagementChange = {
  action: 'create' | 'update'; id?: string; expectedUpdatedAt?: string;
  fullName: string; email: string; username: string; role: string;
  status: 'Active' | 'Inactive' | 'Blocked'; allowedTabs: string[];
};
export type TenantUserStatusChange = {
  id: string; status: 'Active' | 'Inactive' | 'Blocked'; expectedUpdatedAt: string;
};

export type ReportSignatory = {label:string;name:string;position:string};
export type ReportSignatoriesSnapshot = { version:string; records:ReportSignatory[];schoolName:string;schoolAddress:string };
export type ReportSignatoriesChange = {
  expectedVersion:string;records:ReportSignatory[];schoolName:string;schoolAddress:string;confirmation:string;
};
export type FinanceSnapshot = {
  scope:'active_period'; ay:string; term:string; generatedAt:string; reportType:string;
  totals:{label:string;count:number;amountCentavos:number;meaning:string}[];
};
export type RealignmentRecord = {
  id:string; when:string; from:string;to:string;amountCentavos:number;reason:string;encodedBy:string|null;
};
export type RealignmentPage = {
  scope:'active_period';ay:string;term:string;hasMore:boolean;nextCursor:string|null;entries:RealignmentRecord[];
};
export type SetupReview={
 scope:'active_period';ay:string;term:string;
 calendar:{mode:string;includeSummer:boolean}|null;
 fundsTotal:number;feesTotal:number;
 funds:{id:string;name:string;openingCentavos:number}[];
 fees:{id:string;category:string;name:string;amountCentavos:number;targetFund:string;isPackage:boolean}[];
};
export type MobileAcademicCalendar = {
  activeAy: string; activeTerm: string;
  configurations: { academicYear: string; mode: 'Semester' | 'Trimester' | 'FullYear';
    includeSummer: boolean; updatedAt: string }[];
};
export type MobileAcademicCalendarChange = {
  academicYear: string; mode: 'Semester' | 'Trimester' | 'FullYear';
  includeSummer: boolean; expectedUpdatedAt: string | null;
};
export type TenantPortalStatus = {
  organization: {
    subdomain: string;
    name: string;
    type: string;
    status: OrganizationStatus;
    tier: SubscriptionTier;
    schoolGroup: string;
    activeAy: string;
    activeTerm: string;
  };
  studentsCount: number;
  officersCount: number;
  currentTermCollectionsCount: number;
  mode: 'read_only';
  asOf: string;
};

/** Student-owned, OTP-verified status explanations. No transaction IDs or raw ledger data. */
export type StudentHoldReason = {
  kind: 'enrollment' | 'package' | 'penalty' | 'collectible' | 'previous_period' | 'cash_advance' | 'assessment';
  label: string;
  /** Null for non-payable requirements, including cash advances awaiting liquidation. */
  amountCentavos: number | null;
  academicYear?: string;
  term?: string;
};

export type ClearanceResult = {
  /** Hidden on anonymous public lookups; present for authorized officers. */
  studentName: string | null;
  studentId: string | null;
  status: 'cleared' | 'hold' | 'not_enrolled';
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
  /** Student-only after registered-email OTP; omitted for officer lookups and older servers. */
  holdReasons?: StudentHoldReason[];
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
  /** Base official receipt for package allocation suffixes, supplied by server for collections. */
  receiptNumber?: string;
  /** Collection line within the issued receipt; provided only for collection entries. */
  receiptLine?: number;
  /** Present for all-period Activity, supplied by the web-ledger service. */
  academicYear?: string;
  term?: string;
};

export type LedgerPage = {
  records: LedgerEntry[]; nextCursor: string | null; hasMore: boolean;
  scope: 'active' | 'all'; pageSize: number;
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
  /** Web Overview values, read-only; optional for pre-patch server compatibility. */
  remainingBalanceCentavos?: number;
  totalCollectedCentavos?: number;
  totalExpensesCentavos?: number;
  unliquidatedCentavos?: number;
  carriedInCentavos?: number;
  carriedOutCentavos?: number;
  depositedCentavos?: number;
  withdrawnCentavos?: number;
  periodClosed?: boolean;
  funds?: {
    name: string;
    initialCentavos: number;
    transfersCentavos: number;
    collectedCentavos: number;
    disbursedCentavos: number;
    unliquidatedCentavos: number;
    balanceCentavos: number;
  }[];
  pendingAdvances?: {
    id: string;
    advanceId: string;
    requestor: string;
    amountCentavos: number;
    fund: string;
    date: string;
    due: string;
    status: string;
  }[];
};

export type Student = {
  id: string;
  studentId: string;
  fullName: string;
  yearLevel: string;
  /** Ken's web app calls a dropped student "Inactive"; older servers send 'Dropped'. Show via `enrollmentLabel`. */
  enrollmentStatus: 'Enrolled' | 'Dropped' | 'Inactive';
  /** Private. Returned only when the officer has tab-students, never to payment-only users. */
  email?: string | null;
  termStatus?: string;
};

export type StudentRosterSnapshot = {
  studentId: string; fullName: string; yearLevel: string;
  email: string | null; enrollmentStatus: 'Enrolled' | 'Inactive';
};
export type StudentRosterMutation =
  | { action: 'create'; studentId: string; fullName: string; yearLevel: string;
      email: string | null; enrollmentStatus: 'Enrolled' | 'Inactive' }
  | { action: 'update'; id: string; studentId: string; fullName: string; yearLevel: string;
      email: string | null; enrollmentStatus: 'Enrolled' | 'Inactive'; expected: StudentRosterSnapshot;
      emailChangeIdentityVerified: boolean }
  | { action: 'enrollment'; id: string; enrollmentStatus: 'Enrolled' | 'Inactive';
      expected: StudentRosterSnapshot };
export type StudentRosterMutationResult = {
  success: true; id: string; status: 'Enrolled' | 'Inactive'; changed: boolean;
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
/** Bounded, current-period financial read-only module. Never a posting authority. */
export type FinanceReviewKind = 'penalties' | 'advances' | 'liquidations' | 'collections';
export type FinanceReviewEntry = {
  id: string; reference: string; title: string; subtitle: string;
  status: string; amountCentavos: number; when: string;
};
export type FinanceReviewResponse = {
  kind: FinanceReviewKind;
  scope: 'active_period';
  ay: string; term: string;
  limit: number; hasMore: boolean;
  /** Supplied by the v1.5.0 web API. Older servers may omit this. */
  nextCursor?: string | null;
  amountMeaning: string;
  entries: FinanceReviewEntry[];
};

export type ReceiptReference = {
  id: string; reference: string; name: string; studentNumber: string; when: string;
  status: 'Valid' | 'Voided' | 'Inconsistent'; amountPesos: number | null;
  inconsistent: string; allocationCount: number; description: string;
};
export type VoidReference = {
  id: string; reference: string; kind: string; when: string; reason: string; amountCentavos: number;
};
export type ReceiptReferenceSearch = { kind: 'receipts'; scope: 'active_period';
  ay: string; term: string; query: string; records: ReceiptReference[] };
export type VoidReferenceSearch = { kind: 'void'; scope: 'tenant_all_periods';
  query: string; records: VoidReference[] };
/** Read-only keyset pages of the existing web VoidTransaction audit trail. */
export type VoidAuditPage = { scope: 'tenant_all_periods'; records: VoidReference[];
  hasMore: boolean; nextCursor: string | null; pageSize: number };

export type MobileWriteAction = import('../lib/write-permissions').MobileWriteAction;
export type MobileWritePolicy = import('../lib/write-permissions').MobileWritePolicy;

export type ClearApi = {
  mode: 'http' | 'mock';
  // public
  listOrganizations(): Promise<Organization[]>;
  getOrganization(org: string): Promise<Organization>;
  lookupClearance(org: string, query: string, session?: Session | null): Promise<ClearanceResult>;
  /** Student-only registered-email OTP; the server never reveals membership. */
  requestStudentClearanceCode(org: string, studentId: string, email: string): Promise<{ message: string }>;
  verifyStudentClearanceCode(org: string, studentId: string, email: string, code: string): Promise<{ token: string; expiresAt: string }>;
  getOwnClearance(org: string, studentToken: string): Promise<ClearanceResult>;
  revokeStudentClearance(org: string, studentToken: string): Promise<void>;
  listFeeItems(org: string): Promise<FeeItem[]>;
  submitProof(org: string, p: ProofSubmission): Promise<{ submissionId: string }>;
  // sign-in
  /** Same reply whether or not the email is an officer's (no account probing). */
  requestCode(org: string, email: string): Promise<{ sentTo: string; message?: string }>;
  verifyCode(org: string, email: string, code: string): Promise<Session>;
  /** Re-validates a stored token; throws ApiError('unauthorized') when it is no longer good. */
  restoreSession(org: string, token: string): Promise<Session>;
  signOut(session: Session): Promise<void>;
  /** Signed-in officer identity-only profile changes; no financial/business writes. */
  requestOfficerEmailChangeCurrentCode(session: Session): Promise<{ message: string }>;
  verifyOfficerEmailChangeCurrentCode(session: Session, code: string): Promise<{ verified: true }>;
  requestOfficerEmailChangeNewCode(session: Session, newEmail: string): Promise<{ message: string }>;
  confirmOfficerEmailChange(session: Session, newEmail: string, code: string): Promise<{ success: true; message: string }>;
  // global superadmin — separate OTP policy, session and read-only overview.
  requestGlobalCode(email: string): Promise<{ message: string }>;
  verifyGlobalCode(email: string, code: string): Promise<GlobalSession>;
  restoreGlobalSession(token: string): Promise<GlobalSession>;
  signOutGlobal(session: GlobalSession): Promise<void>;
  getGlobalOverview(session: GlobalSession): Promise<GlobalOverview>;
  getGlobalManagementCapabilities(session: GlobalSession): Promise<{tenantOperationsEnabled:boolean}>;
  getGlobalMaintenance(session: GlobalSession): Promise<GlobalMaintenancePage>;
  changeGlobalMaintenance(session: GlobalSession, change: GlobalMaintenanceChange): Promise<{success:true}>;
  /** Separate Global Administrator identity; never impersonate a tenant officer. */
  requestGlobalWebHandoff(session: GlobalSession): Promise<{ url: string }>;
  listManagedTenants(session: GlobalSession): Promise<ManagedTenant[]>;
  provisionTenant(session: GlobalSession, payload: NewTenant): Promise<ProvisionResult>;
  manageTenant(session: GlobalSession, payload: {
    organizationId: string; action: 'status' | 'tier' | 'group'; value: string; confirmation: string;
  }): Promise<{ success: boolean; organization: string }>;
  /** Read-only across ALL tenants, including inactive or archived, as on web. */
  getGlobalTenantDashboard(session: GlobalSession, slug: string): Promise<GlobalTenantDashboard>;
  listGlobalTenantStudents(session: GlobalSession, slug: string, q?: string): Promise<Student[]>;
  listGlobalTenantLedger(session: GlobalSession, slug: string): Promise<LedgerEntry[]>;
  listGlobalTenantLedgerPage(session: GlobalSession, slug: string, cursor?: string): Promise<LedgerPage>;
  listGlobalTenantRemittances(session: GlobalSession, slug: string): Promise<LedgerEntry[]>;
  // officer
  /** Server-issued capability grants; deny all when unavailable. */
  getWriteCapabilities(s: Session): Promise<MobileWritePolicy>;
  /** Disabled server-side until one-time browser exchange is audited. */
  requestOfficerWebHandoff(s: Session): Promise<{ url: string }>;
  /** Session metadata only; all server requests independently check tenant and tab permissions. */
  getOfficerOnboarding(s: Session): Promise<{ exempt: boolean; completed: boolean; tabs: string[] }>;
  completeOfficerOnboarding(s: Session): Promise<{ exempt: boolean; completed: boolean }>;
  pulseOfficerPresence(s: Session, page: 'overview' | 'students' | 'remittances', tabId: string): Promise<{ colleagues: { id: string; name: string }[]; count: number }>;
  leaveOfficerPresence(s: Session, tabId: string): Promise<{ ok: true }>;
  getTenantPortal(s: Session): Promise<TenantPortalStatus>;
  getAcademicCalendar(s: Session): Promise<MobileAcademicCalendar>;
  getSetupReview(s: Session): Promise<SetupReview>;
  getFinanceSnapshot(s: Session): Promise<FinanceSnapshot>;
  getReportSignatories(s:Session):Promise<ReportSignatoriesSnapshot>;
  saveReportSignatories(s:Session,input:ReportSignatoriesChange):Promise<{success:true}>;
  getRealignmentReview(s: Session, cursor?:string): Promise<RealignmentPage>;
  updateAcademicCalendar(s: Session, change: MobileAcademicCalendarChange): Promise<{ success: true }>;
  listTenantUsers(s: Session, search?: string, cursor?: string): Promise<TenantUsersPage>;
  listCollectibles(s: Session, cursor?: string): Promise<CollectiblePage>;
  updateTenantUserStatus(s: Session, input: TenantUserStatusChange): Promise<{ success: true }>;
  manageTenantUser(s: Session, input: TenantUserManagementChange): Promise<{ success: true; id: string }>;
  getDashboard(s: Session): Promise<DashboardSummary>;
  listLedger(s: Session, filter?: { status?: string; limit?: number }): Promise<LedgerEntry[]>;
  listLedgerPage(s: Session, cursor?: string, scope?: 'active' | 'all'): Promise<LedgerPage>;
  /** Server authorizes tab-void independently of overview and reporting grants. */
  listVoidAudit(s: Session, cursor?: string): Promise<VoidAuditPage>;
  /** Independently permission-checked, current period and read-only. */
  getFinanceReview(s: Session, kind: FinanceReviewKind, limit?: number, cursor?: string): Promise<FinanceReviewResponse>;
  /** Authorized GET-only exact reference search; no receipt/void mutations. */
  searchReceiptReferences(s: Session, q: string): Promise<ReceiptReferenceSearch>;
  searchVoidReferences(s: Session, q: string): Promise<VoidReferenceSearch>;
  /** Accessible to tab-remittances even without tab-overview. */
  listPendingRemittances(s: Session): Promise<LedgerEntry[]>;
  listStudents(s: Session, q?: string, missingEmailOnly?: boolean): Promise<Student[]>;
  updateStudentRoster(s: Session, change: StudentRosterMutation): Promise<StudentRosterMutationResult>;
  recordPayment(s: Session, p: { studentId: string; feeId: string; amountCentavos: number; idempotencyKey: string }): Promise<{ reference: string; title: string; orNumber: string; balanceDue: number; paymentEntries: number; paymentType: string }>;
  getRemittance(s: Session, id: string): Promise<RemittanceDetail>;
  verifyRemittance(s: Session, id: string, p: { orNumber: string; fundAllocation?: string }): Promise<{ orNumber: string }>;
  invalidateRemittance(s: Session, id: string): Promise<{ ok: true }>;
};
