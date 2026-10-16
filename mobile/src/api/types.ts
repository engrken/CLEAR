// Shapes of the mobile REST API (Phase 2, app/api/mobile/** in the web app).
// Money is integer centavos.

export type Organization = {
  subdomain: string;
  name: string;
  type: 'Department' | 'Organization';
  logoUrl: string | null;
  activeAy: string;
  activeTerm: string;
};

export type Role = 'admin' | 'treasurer' | 'auditor' | 'viewer';

export type Officer = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  /** Effective permission tab IDs (admins get all), as in lib/permissions.ts. */
  allowedTabs: string[];
};

/** A bearer token bound to one officer in one org; lasts 7 days. */
export type Session = { token: string; officer: Officer; org: Organization; expiresAt: string };

export type ClearanceResult = {
  studentName: string;
  studentId: string;
  status: 'cleared' | 'hold';
  /** null on public lookups (cleared/on hold only); filled for an officer token with tab-clearance. */
  outstandingCentavos: number | null;
  /** The absolute, signed verification URL the web checks live. Encode as-is in the QR. */
  qrToken: string | null;
  ay: string;
  term: string;
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
  enrollmentStatus: 'Enrolled' | 'Dropped';
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
  | 'invalid' | 'unauthorized' | 'forbidden' | 'not_officer' | 'not_found' | 'conflict'
  | 'duplicate_or' | 'payload_too_large' | 'invalid_student' | 'cooldown' | 'locked'
  | 'no_code' | 'expired' | 'mismatch' | 'send_failed' | 'server_error' | 'network';

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
  requestCode(org: string, email: string): Promise<{ sentTo: string }>;
  verifyCode(org: string, email: string, code: string): Promise<Session>;
  /** Re-validates a stored token; throws ApiError('unauthorized') when it is no longer good. */
  restoreSession(org: string, token: string): Promise<Session>;
  signOut(session: Session): Promise<void>;
  // officer
  getDashboard(s: Session): Promise<DashboardSummary>;
  listLedger(s: Session, filter?: { status?: string; limit?: number }): Promise<LedgerEntry[]>;
  listStudents(s: Session, q?: string): Promise<Student[]>;
  recordPayment(s: Session, p: { studentId: string; feeId: string; amountCentavos: number; orNumber: string }): Promise<LedgerEntry>;
  getRemittance(s: Session, id: string): Promise<RemittanceDetail>;
  verifyRemittance(s: Session, id: string, p: { orNumber: string; fundAllocation?: string }): Promise<{ orNumber: string }>;
  invalidateRemittance(s: Session, id: string): Promise<{ ok: true }>;
};
