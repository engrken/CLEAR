/**
 * Fictional, browser-safe fixtures for the public CLEAR walkthrough.
 * Do not connect this module to Prisma, authentication, or real tenant APIs.
 */
export type DemoModuleId =
  | 'overview' | 'clearance' | 'students' | 'collections' | 'remittances'
  | 'cashier-remittance' | 'advances' | 'liquidations' | 'penalties'
  | 'collectibles' | 'reports' | 'summary' | 'realign' | 'void'
  | 'users' | 'logs' | 'setup';

export type DemoModule = {
  id: DemoModuleId;
  label: string;
  tab: string;
  icon: string;
  category: 'Core' | 'Operations' | 'Audit & Reporting' | 'Administration';
  description: string;
};

export const DEMO_MODULES: DemoModule[] = [
  { id: 'overview', label: 'Overview', tab: 'tab-overview', icon: 'bi-speedometer2', category: 'Core', description: 'Treasury KPIs, cash safekeeping, fund balances and pending cash advances.' },
  { id: 'clearance', label: 'Clearance', tab: 'tab-clearance', icon: 'bi-person-check', category: 'Core', description: 'Student clearance status, outstanding obligations, and reasons for holds.' },
  { id: 'students', label: 'Students Roster', tab: 'tab-students', icon: 'bi-people', category: 'Core', description: 'Search, verify and organize student enrollment records by academic period.' },
  { id: 'collections', label: 'Collections', tab: 'tab-payment', icon: 'bi-cash-stack', category: 'Operations', description: 'Official receipts, payment history and collection monitoring.' },
  { id: 'remittances', label: 'Remittance Queue', tab: 'tab-remittances', icon: 'bi-upload', category: 'Operations', description: 'Online remittance submissions awaiting officer verification.' },
  { id: 'cashier-remittance', label: 'Univ. Cashier Deposit', tab: 'tab-payment', icon: 'bi-safe2', category: 'Operations', description: 'Deposit, withdrawal and university cashier safekeeping tracking.' },
  { id: 'advances', label: 'Cash Advances', tab: 'tab-advances', icon: 'bi-journal-arrow-up', category: 'Operations', description: 'Cash advance register, active balances and liquidation tracking.' },
  { id: 'liquidations', label: 'Liquidations', tab: 'tab-audit', icon: 'bi-receipt', category: 'Operations', description: 'Expense supporting records and cash advance liquidation review.' },
  { id: 'penalties', label: 'Penalties & Fines', tab: 'tab-penalties', icon: 'bi-exclamation-octagon', category: 'Operations', description: 'Penalties, assessed amounts, payments and unsettled balances.' },
  { id: 'collectibles', label: 'Collectibles & Dues', tab: 'tab-collectibles', icon: 'bi-inbox', category: 'Operations', description: 'Student receivables, dues, assessments and arrears.' },
  { id: 'reports', label: 'Detailed Reports', tab: 'tab-reports', icon: 'bi-bar-chart-line', category: 'Audit & Reporting', description: 'Period-based financial activity, collection and disbursement reports.' },
  { id: 'summary', label: 'Summary Report', tab: 'tab-report', icon: 'bi-file-earmark-text', category: 'Audit & Reporting', description: 'Consolidated treasury summary and report-ready balances.' },
  { id: 'realign', label: 'Realign Funds', tab: 'tab-transfer', icon: 'bi-arrow-left-right', category: 'Audit & Reporting', description: 'Review sample transfers between fund allocations.' },
  { id: 'void', label: 'Void Center', tab: 'tab-void', icon: 'bi-slash-circle', category: 'Administration', description: 'Audit-ready history of voided financial documents.' },
  { id: 'users', label: 'User Management', tab: 'tab-users', icon: 'bi-person-gear', category: 'Administration', description: 'Officer accounts, assigned roles and module permission settings.' },
  { id: 'logs', label: 'System Logs', tab: 'admin-only', icon: 'bi-journal-text', category: 'Administration', description: 'Organization activity history and audit events.' },
  { id: 'setup', label: 'System Setup', tab: 'tab-setup', icon: 'bi-sliders', category: 'Administration', description: 'Academic calendar, fund categories, signatories and configuration.' },
];

export type DemoRow = { id: string; cells: string[]; status: string; details: string };
export type DemoModuleView = { headings: string[]; rows: DemoRow[]; metrics: [string, string][]; hint: string };

export const DEMO_VIEWS: Record<Exclude<DemoModuleId, 'overview'>, DemoModuleView> = {
  clearance: {
    headings: ['Student ID', 'Student', 'Status', 'Hold details'],
    rows: [
      { id: 'DEMO-ST-001', cells: ['DEMO-ST-001', 'Alex Santos', 'Cleared', 'No outstanding obligations'], status: 'Cleared', details: 'Eligible for clearance. All sample obligations have been settled.' },
      { id: 'DEMO-ST-002', cells: ['DEMO-ST-002', 'Jamie Cruz', 'Not Cleared', 'Unsettled membership dues'], status: 'Not Cleared', details: 'Hold reason: membership dues of ₱150.00 are unpaid.' },
      { id: 'DEMO-ST-003', cells: ['DEMO-ST-003', 'Taylor Reyes', 'Not Cleared', 'Unsettled penalty'], status: 'Not Cleared', details: 'Hold reason: sample late attendance penalty remains unsettled.' },
      { id: 'DEMO-ST-004', cells: ['DEMO-ST-004', 'Sam Garcia', 'Cleared', 'No outstanding obligations'], status: 'Cleared', details: 'Eligible for clearance.' },
    ],
    metrics: [['Students', '4'], ['Cleared', '2'], ['Pending', '2']], hint: 'In the live application students can view their own clearance status and hold reasons after verification.',
  },
  students: {
    headings: ['Student ID', 'Full Name', 'Year', 'Enrollment Status'],
    rows: [
      { id: 'DEMO-ST-001', cells: ['DEMO-ST-001', 'Alex Santos', '1st Year', 'Active'], status: 'Active', details: 'Sample student with a cleared record and active enrollment.' },
      { id: 'DEMO-ST-002', cells: ['DEMO-ST-002', 'Jamie Cruz', '2nd Year', 'Active'], status: 'Active', details: 'Sample student enrolled for the displayed academic period.' },
      { id: 'DEMO-ST-003', cells: ['DEMO-ST-003', 'Taylor Reyes', '3rd Year', 'Active'], status: 'Active', details: 'Sample student with an outstanding penalty.' },
      { id: 'DEMO-ST-004', cells: ['DEMO-ST-004', 'Sam Garcia', '4th Year', 'Active'], status: 'Active', details: 'Sample senior student with a cleared record.' },
    ],
    metrics: [['Enrolled students', '4'], ['Active', '4'], ['Years represented', '4']], hint: 'Real officers can add, edit, import and promote students subject to their assigned permissions.',
  },
  collections: {
    headings: ['Official Receipt', 'Student', 'Fund', 'Amount', 'Status'],
    rows: [
      { id: 'DEMO-OR-001', cells: ['DEMO-OR-001', 'Alex Santos', 'General Fund', '₱250.00', 'Paid'], status: 'Paid', details: 'Example official receipt: cash collection for General Fund, issued in the sample term.' },
      { id: 'DEMO-OR-002', cells: ['DEMO-OR-002', 'Sam Garcia', 'Activities', '₱300.00', 'Paid'], status: 'Paid', details: 'Example activities collection; not a real payment.' },
      { id: 'DEMO-OR-003', cells: ['DEMO-OR-003', 'Jamie Cruz', 'General Fund', '₱150.00', 'Pending'], status: 'Pending', details: 'Example collection pending confirmation.' },
    ],
    metrics: [['Sample receipts', '3'], ['Paid receipts', '2'], ['Awaiting confirmation', '1']], hint: 'The live module supports logging collections, official receipts and payment history. Public demo entries are never submitted.',
  },
  remittances: {
    headings: ['Reference', 'Sender', 'Channel', 'Amount', 'Verification'],
    rows: [
      { id: 'DEMO-REM-001', cells: ['DEMO-REM-001', 'Jamie Cruz', 'GCash', '₱150.00', 'Awaiting Review'], status: 'Awaiting Review', details: 'Fictional GCash remittance awaiting officer verification; no proof file or actual transaction exists.' },
      { id: 'DEMO-REM-002', cells: ['DEMO-REM-002', 'Alex Santos', 'Maya', '₱250.00', 'Verified'], status: 'Verified', details: 'Example of an accepted remittance with simulated verification status.' },
    ],
    metrics: [['Submitted', '2'], ['Awaiting review', '1'], ['Verified', '1']], hint: 'The actual application verifies uploaded proofs and supports authorized receipt issuance.',
  },
  'cashier-remittance': {
    headings: ['Reference', 'Transaction', 'Amount', 'Purpose', 'Status'],
    rows: [
      { id: 'DEMO-CASH-001', cells: ['DEMO-CASH-001', 'Deposit', '₱3,000.00', 'Treasury safekeeping', 'Recorded'], status: 'Recorded', details: 'Fictional transfer of funds to the university cashier.' },
      { id: 'DEMO-CASH-002', cells: ['DEMO-CASH-002', 'Deposit', '₱1,000.00', 'Event proceeds', 'Recorded'], status: 'Recorded', details: 'Sample cashier deposit.' },
    ],
    metrics: [['Cashier balance', '₱4,000.00'], ['Total deposits', '₱4,000.00'], ['Total withdrawals', '₱0.00']], hint: 'The real module records cashier deposits and withdrawals with financial controls.',
  },
  advances: {
    headings: ['Advance Reference', 'Requestor', 'Purpose', 'Amount', 'Status'],
    rows: [
      { id: 'DEMO-CA-001', cells: ['DEMO-CA-001', 'Alex Santos', 'Event materials', '₱1,200.00', 'Unliquidated'], status: 'Unliquidated', details: 'Fictional cash advance awaiting supporting liquidation documents.' },
      { id: 'DEMO-CA-002', cells: ['DEMO-CA-002', 'Sam Garcia', 'Workshop supplies', '₱800.00', 'Liquidated'], status: 'Liquidated', details: 'Example advance with completed liquidation.' },
    ],
    metrics: [['Advances', '2'], ['Unliquidated', '₱1,200.00'], ['Liquidated', '1']], hint: 'The production module issues advances and tracks liquidation references.',
  },
  liquidations: {
    headings: ['Liquidation ID', 'Reference', 'Expense', 'Amount', 'Audit Status'],
    rows: [
      { id: 'DEMO-LIQ-001', cells: ['DEMO-LIQ-001', 'DEMO-CA-002', 'Workshop supplies', '₱800.00', 'Approved'], status: 'Approved', details: 'Synthetic liquidation tied to a sample cash advance.' },
      { id: 'DEMO-LIQ-002', cells: ['DEMO-LIQ-002', 'General Fund', 'Printing expenses', '₱350.00', 'For Audit'], status: 'For Audit', details: 'Sample expense with review status. No real invoice is attached.' },
    ],
    metrics: [['Liquidations', '2'], ['Approved', '1'], ['For audit', '1']], hint: 'Live workflows include cash advance reference tracking and supporting document checks.',
  },
  penalties: {
    headings: ['Penalty ID', 'Student', 'Reason', 'Amount', 'Status'],
    rows: [
      { id: 'DEMO-PEN-001', cells: ['DEMO-PEN-001', 'Taylor Reyes', 'Late attendance', '₱75.00', 'Unpaid'], status: 'Unpaid', details: 'Synthetic penalty; does not affect a real student clearance.' },
      { id: 'DEMO-PEN-002', cells: ['DEMO-PEN-002', 'Alex Santos', 'Event absence', '₱50.00', 'Paid'], status: 'Paid', details: 'Synthetic penalty marked settled.' },
    ],
    metrics: [['Penalties', '2'], ['Unpaid', '₱75.00'], ['Paid', '₱50.00']], hint: 'Actual officers can assess and collect penalties according to configured rules.',
  },
  collectibles: {
    headings: ['Assessment ID', 'Student', 'Type', 'Amount', 'Status'],
    rows: [
      { id: 'DEMO-DUE-001', cells: ['DEMO-DUE-001', 'Jamie Cruz', 'Membership dues', '₱150.00', 'Outstanding'], status: 'Outstanding', details: 'Example membership balance affecting clearance.' },
      { id: 'DEMO-DUE-002', cells: ['DEMO-DUE-002', 'Taylor Reyes', 'Activity dues', '₱100.00', 'Outstanding'], status: 'Outstanding', details: 'Example student receivable.' },
      { id: 'DEMO-DUE-003', cells: ['DEMO-DUE-003', 'Alex Santos', 'Membership dues', '₱150.00', 'Settled'], status: 'Settled', details: 'Sample paid dues.' },
    ],
    metrics: [['Assessed', '₱400.00'], ['Outstanding', '₱250.00'], ['Settled', '₱150.00']], hint: 'The production module manages collectibles, dues, assessments and overdue records.',
  },
  reports: {
    headings: ['Report', 'Academic period', 'Coverage', 'Status'],
    rows: [
      { id: 'DEMO-RPT-001', cells: ['Collections Detail', 'A.Y. 2026–2027', 'Cash receipts and remittances', 'Available'], status: 'Available', details: 'Illustrative report content only. Exporting real financial data is disabled.' },
      { id: 'DEMO-RPT-002', cells: ['Liquidation Detail', 'A.Y. 2026–2027', 'Audited expenses and advances', 'Available'], status: 'Available', details: 'Sample audit report preview.' },
      { id: 'DEMO-RPT-003', cells: ['Fund Ledger', 'A.Y. 2026–2027', 'Individual fund movement', 'Available'], status: 'Available', details: 'Sample ledger showing synthetic transfers and balances.' },
    ],
    metrics: [['Available report types', '3'], ['Data source', 'Fictional'], ['Exports', 'Disabled']], hint: 'Live authorized accounts can generate detailed period-based financial reports.',
  },
  summary: {
    headings: ['Account Pool', 'Collected', 'Disbursed', 'Closing Balance'],
    rows: [
      { id: 'DEMO-FUND-001', cells: ['General Fund', '₱7,000.00', '₱2,700.00', '₱4,300.00'], status: 'Active', details: 'Example general fund summary.' },
      { id: 'DEMO-FUND-002', cells: ['Event Fund', '₱3,500.00', '₱2,000.00', '₱1,500.00'], status: 'Active', details: 'Example event fund summary.' },
      { id: 'DEMO-FUND-003', cells: ['Activities', '₱2,000.00', '₱1,100.00', '₱900.00'], status: 'Active', details: 'Example activities fund summary.' },
    ],
    metrics: [['Collected', '₱12,500.00'], ['Expenses + advances', '₱5,800.00'], ['Treasury balance', '₱6,700.00']], hint: 'Live reports use the financial ledger and configured signatories.',
  },
  realign: {
    headings: ['Transfer ID', 'Source', 'Destination', 'Amount', 'Status'],
    rows: [
      { id: 'DEMO-TR-001', cells: ['DEMO-TR-001', 'General Fund', 'Activities', '₱200.00', 'Approved'], status: 'Approved', details: 'Example internal fund transfer; no new collection is recorded.' },
      { id: 'DEMO-TR-002', cells: ['DEMO-TR-002', 'Event Fund', 'General Fund', '₱100.00', 'For Review'], status: 'For Review', details: 'Example pending funds realignment.' },
    ],
    metrics: [['Transfers', '2'], ['Approved', '1'], ['Pending', '1']], hint: 'Funds can be realigned only by users with the proper transfer permission.',
  },
  void: {
    headings: ['Document', 'Reference', 'Reason', 'Status'],
    rows: [
      { id: 'DEMO-VOID-001', cells: ['Official Receipt', 'DEMO-OR-009', 'Duplicate entry', 'Voided'], status: 'Voided', details: 'Illustrative void record and audit reason, not a real receipt.' },
      { id: 'DEMO-VOID-002', cells: ['Penalty Assessment', 'DEMO-PEN-009', 'Assessment correction', 'Voided'], status: 'Voided', details: 'Example historical voided penalty.' },
    ],
    metrics: [['Voided documents', '2'], ['Audit notes', '2'], ['Financial actions', 'Disabled']], hint: 'Voiding live records is protected and audited. The public demo only shows historical examples.',
  },
  users: {
    headings: ['Officer', 'Role', 'Access', 'Status'],
    rows: [
      { id: 'DEMO-USR-001', cells: ['Morgan Lee', 'Administrator', 'All tenant modules', 'Active'], status: 'Active', details: 'Fictional organization administrator. Not a global administrator.' },
      { id: 'DEMO-USR-002', cells: ['Robin Tan', 'Treasurer', 'Finance and reports', 'Active'], status: 'Active', details: 'Fictional treasurer assigned the preset role permissions.' },
      { id: 'DEMO-USR-003', cells: ['Casey Lim', 'Auditor', 'Audit and reports', 'Active'], status: 'Active', details: 'Fictional organization auditor.' },
    ],
    metrics: [['Officers', '3'], ['Active', '3'], ['Invitations', 'Disabled']], hint: 'Actual administrators configure users, role presets and custom module permissions.',
  },
  logs: {
    headings: ['Event ID', 'Action', 'Actor', 'Recorded at'],
    rows: [
      { id: 'DEMO-LOG-001', cells: ['DEMO-LOG-001', 'Sample collection recorded', 'Robin Tan', 'Nov 12, 2026'], status: 'Recorded', details: 'Fictional append-only activity example.' },
      { id: 'DEMO-LOG-002', cells: ['DEMO-LOG-002', 'Sample liquidation approved', 'Casey Lim', 'Nov 13, 2026'], status: 'Recorded', details: 'Fictional audit trail example.' },
    ],
    metrics: [['Activity entries', '2'], ['Source', 'Fictional'], ['Audit export', 'Disabled']], hint: 'System logs are visible only to authorized tenant administrators.',
  },
  setup: {
    headings: ['Configuration', 'Value', 'Scope', 'Status'],
    rows: [
      { id: 'DEMO-SET-001', cells: ['Academic Calendar', 'Semester', 'Organization', 'Configured'], status: 'Configured', details: 'Sample period mode: semester. Live organizations manage their own academic calendars.' },
      { id: 'DEMO-SET-002', cells: ['Fee Packages', 'Membership and activity dues', 'Organization', 'Configured'], status: 'Configured', details: 'Illustrative collection setup; no production configuration is modified.' },
      { id: 'DEMO-SET-003', cells: ['Signatories', 'President / Treasurer / Auditor', 'Reports', 'Configured'], status: 'Configured', details: 'Fictional signatories for report previews.' },
      { id: 'DEMO-SET-004', cells: ['Fund Accounts', 'General, Events, Activities', 'Treasury', 'Configured'], status: 'Configured', details: 'Synthetic fund categories used throughout the sample demo.' },
    ],
    metrics: [['Academic calendar', 'Semester'], ['Sample fund pools', '3'], ['Saved changes', 'None']], hint: 'Production settings are restricted to authorized administrators and persist only in their own tenant.',
  },
};

export const DEMO_FUNDS = [
  { name: 'General Fund', opening: 0, transfers: 0, collected: 7000, spent: 2700, balance: 4300 },
  { name: 'Event Fund', opening: 0, transfers: 0, collected: 3500, spent: 2000, balance: 1500 },
  { name: 'Activities', opening: 0, transfers: 0, collected: 2000, spent: 1100, balance: 900 },
];
