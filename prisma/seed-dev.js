// /prisma/seed-dev.js
//
// Local development seed: two isolated test departments with officers of every
// role, a small student roster, funds and fee items. Safe to re-run (it wipes
// and recreates only the two dev organizations).
//
// Usage:  npm run db:seed:dev
//
// Refuses to run unless DATABASE_URL points at localhost, so it can never
// touch the production Neon database.

const { PrismaClient } = require('@prisma/client');

const dbUrl = process.env.DATABASE_URL || '';
let dbHost = '';
try {
  dbHost = new URL(dbUrl).hostname;
} catch {
  // fall through to the guard below
}
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(dbHost)) {
  console.error(`Refusing to seed: DATABASE_URL host is "${dbHost || 'unset'}", not localhost.`);
  process.exit(1);
}

const prisma = new PrismaClient();

const AY = 'A.Y. 2026 - 2027';
const TERM = '1st Sem';

const ALL_TABS = [
  'tab-overview', 'tab-students', 'tab-clearance', 'tab-payment',
  'tab-remittances', 'tab-penalties', 'tab-advances', 'tab-audit',
  'tab-collectibles', 'tab-reports', 'tab-void', 'tab-report',
  'tab-transfer', 'tab-users', 'tab-setup',
];

// Mirrors PRESET_ROLE_TABS in lib/permissions.ts
const ROLE_TABS = {
  admin: ALL_TABS,
  treasurer: [
    'tab-overview', 'tab-clearance', 'tab-reports', 'tab-payment',
    'tab-remittances', 'tab-penalties', 'tab-advances', 'tab-collectibles',
    'tab-report', 'tab-transfer',
  ],
  auditor: ['tab-overview', 'tab-clearance', 'tab-reports', 'tab-audit', 'tab-report'],
  viewer: ['tab-overview', 'tab-clearance', 'tab-reports', 'tab-report'],
};

const ORGS = [
  { subdomain: 'devdept', name: 'Dev Department of Engineering', prefix: 'DEV' },
  { subdomain: 'otherdept', name: 'Other Department (isolation test)', prefix: 'OTH' },
];

const FUNDS = [
  { fundName: 'General Fund', initialAllocation: 5000 },
  { fundName: 'Activity Fund', initialAllocation: 2000 },
];

const FEES = [
  { category: 'Membership', name: 'Membership Fee', amount: 150, targetFund: 'General Fund' },
  { category: 'Membership', name: 'Org Shirt', amount: 350, targetFund: 'Activity Fund' },
  { category: 'Event', name: 'Acquaintance Party', amount: 200, targetFund: 'Activity Fund' },
];

const STUDENTS = [
  ['Ana Reyes', '1st Year'],
  ['Ben Santos', '1st Year'],
  ['Carla Cruz', '2nd Year'],
  ['Dario Lim', '3rd Year'],
  ['Elena Bautista', '4th Year'],
];

async function seedOrg({ subdomain, name, prefix }) {
  await prisma.organization.deleteMany({ where: { subdomain } });

  const org = await prisma.organization.create({
    data: { subdomain, name, type: 'Department', activeAy: AY, activeTerm: TERM },
  });

  const users = Object.keys(ROLE_TABS).map((role, i) => ({
    organizationId: org.id,
    userId: `USR-${prefix}-${String(i + 1).padStart(3, '0')}`,
    fullName: `${prefix} ${role[0].toUpperCase()}${role.slice(1)}`,
    username: `${subdomain}-${role}`,
    email: `${role}@${subdomain}.local`,
    role,
    allowedTabs: JSON.stringify(ROLE_TABS[role]),
    status: 'Active',
  }));
  await prisma.tenantUser.createMany({ data: users });

  for (const [i, [fullName, yearLevel]] of STUDENTS.entries()) {
    const studentId = `${prefix}-2026-${String(i + 1).padStart(4, '0')}`;
    const student = await prisma.student.create({
      data: {
        organizationId: org.id,
        studentId,
        fullName,
        yearLevel,
        email: `${studentId.toLowerCase()}@students.local`,
      },
    });
    await prisma.enrollment.create({
      data: {
        organizationId: org.id,
        studentId: student.id,
        academicYear: AY,
        term: TERM,
        enrollmentStatus: 'Enrolled',
        updatedBy: 'seed-dev',
      },
    });
  }

  await prisma.fund.createMany({
    data: FUNDS.map((f) => ({
      organizationId: org.id,
      academicYear: AY,
      term: TERM,
      fundName: f.fundName,
      initialAllocation: f.initialAllocation,
      currentBalance: f.initialAllocation,
    })),
  });

  await prisma.collectionSetup.createMany({
    data: FEES.map((f) => ({ ...f, organizationId: org.id, academicYear: AY, term: TERM })),
  });

  await prisma.signatory.createMany({
    data: [
      { organizationId: org.id, label: 'Prepared by:', name: `${prefix} Treasurer`, position: 'Treasurer', order: 1 },
      { organizationId: org.id, label: 'Approved:', name: `${prefix} Adviser`, position: 'Adviser', order: 2 },
    ],
  });

  return { org, users };
}

async function main() {
  for (const def of ORGS) {
    const { org, users } = await seedOrg(def);
    console.log(`\n${org.name}  ->  http://localhost:3000/department/${org.subdomain}`);
    for (const u of users) console.log(`  ${u.role.padEnd(9)} ${u.email}`);
  }
  console.log(
    '\nSign in with one of the emails above. With MAIL_TRANSPORT=console the 6-digit code\n' +
      'is printed in the dev server log ("[mail:console]") instead of being emailed.\n'
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
