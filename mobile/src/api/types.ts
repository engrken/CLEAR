// Shapes the mobile REST API (Phase 2) will return. Money is integer centavos.

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
  /** Permission tab IDs, as in lib/permissions.ts PRESET_ROLE_TABS. */
  allowedTabs: string[];
};

export type Session = { token: string; officer: Officer; org: Organization; expiresAt: string };

export type ClearanceResult = {
  studentName: string;
  studentId: string;
  status: 'cleared' | 'hold';
  outstandingCentavos: number;
  qrToken: string | null;
  ay: string;
  term: string;
};

export type LedgerEntry = {
  id: string;
  kind: 'collection' | 'online-remittance' | 'penalty' | 'advance' | 'cashier-remittance';
  title: string;
  reference: string;
  subtitle: string;
  amountCentavos: number;
  status: string;
  at: string;
};

export type DashboardSummary = {
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

export type ProofSubmission = {
  studentId: string;
  paymentChannel: 'GCash' | 'Maya' | 'Bank transfer';
  referenceNumber: string;
  amountCentavos: number;
  itemDescription: string;
  fileUri: string;
};

export class ApiError extends Error {
  constructor(message: string, public code: string) {
    super(message);
  }
}
