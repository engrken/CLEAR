// /prisma/seed-demo.js
//
// Creates or refreshes the `demo` organization that Google Play reviewers sign
// in to (see lib/demo-reviewer.ts). Fake data only: one officer (the reviewer),
// a made-up roster, fee items, payments, a penalty and pending online proofs.
//
// It touches ONLY the `demo` organization (deleted and re-created; its rows go
// with it by cascade) and that org's sign-in throttle rows. It refuses to run
// if an existing `demo` org does not look like one this script made.
//
// Usage:
//   local:      node --env-file=.env prisma/seed-demo.js [--yes]
//   production: node --env-file=<production env file> prisma/seed-demo.js
//               (asks you to type the database host; --yes is ignored. Without a
//               terminal, pass --confirm-host <host> with the exact host instead.)
//
// The reviewer email is DEMO_REVIEWER_EMAIL (default reviewer@demo.clear.invalid).
// Use the same value on the server, with DEMO_REVIEWER_CODE, to switch sign-in on.

const crypto = require('node:crypto');
const readline = require('node:readline/promises');
const zlib = require('node:zlib');
const { PrismaClient } = require('@prisma/client');

const DEMO_SLUG = 'demo';
const DEMO_NAME = 'CLEAR Demo Organization (sample data)';
const REVIEWER_EMAIL = String(process.env.DEMO_REVIEWER_EMAIL || 'reviewer@demo.clear.invalid').trim().toLowerCase();
const AY = 'A.Y. 2026 - 2027';
const TERM = '1st Sem';
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

// Mirrors PRESET_ROLE_TABS.treasurer in lib/permissions.ts
const TREASURER_TABS = [
  'tab-overview', 'tab-clearance', 'tab-reports', 'tab-payment',
  'tab-remittances', 'tab-penalties', 'tab-advances', 'tab-collectibles',
  'tab-report', 'tab-transfer',
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

// Made-up people. [name, year level, payments as [fee name, amount]]
const STUDENTS = [
  ['Andrea Villanueva', '1st Year', [['Membership Fee', 150], ['Org Shirt', 350], ['Acquaintance Party', 200]]],
  ['Bryan Dizon', '1st Year', [['Membership Fee', 150], ['Org Shirt', 350], ['Acquaintance Party', 200]]],
  ['Camille Ocampo', '2nd Year', [['Membership Fee', 150], ['Org Shirt', 350], ['Acquaintance Party', 200]]],
  ['Daniel Aquino', '2nd Year', [['Membership Fee', 150]]],
  ['Erika Navarro', '3rd Year', [['Membership Fee', 150], ['Acquaintance Party', 200]]],
  ['Francis Mendoza', '3rd Year', [['Membership Fee', 150], ['Org Shirt', 200]]],
  ['Gwen Salazar', '4th Year', []],
  ['Harold Pascual', '4th Year', []],
  ['Isabel Ramos', '1st Year', []],
  ['Joshua Castillo', '2nd Year', []],
];

// Pending online proofs for the reviewer to verify or invalidate: [student #, channel, fee, amount]
const PROOFS = [
  [7, 'GCash', 'Membership Fee', 150],
  [8, 'Maya', 'Org Shirt', 350],
  [9, 'Bank Transfer', 'Membership Fee', 150],
];

const studentNo = (n) => `DEMO-2026-${String(n).padStart(4, '0')}`;

// ---------------------------------------------------------------- Safety

function dbHost() {
  try {
    return new URL(process.env.DATABASE_URL || '').hostname;
  } catch {
    return '';
  }
}

async function confirm(host) {
  const local = LOCAL_HOSTS.includes(host);
  console.log(`\nThis deletes and re-creates the "${DEMO_SLUG}" organization (and nothing else)`);
  console.log(`on database host: ${host}${local ? ' (local)' : ''}`);
  console.log(`Demo officer: ${REVIEWER_EMAIL}\n`);

  if (local && process.argv.includes('--yes')) return;
  const i = process.argv.indexOf('--confirm-host');
  if (i !== -1) {
    if (process.argv[i + 1] === host) return;
    console.error('--confirm-host does not match the database host. Nothing was changed.');
    process.exit(1);
  }
  if (!process.stdin.isTTY) {
    console.error('Refusing to run without a terminal to confirm in (--yes only works for a local database; or pass --confirm-host <host>).');
    process.exit(1);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`Type the database host to continue (${host}): `)).trim();
  rl.close();
  if (answer !== host) {
    console.error('Host did not match. Nothing was changed.');
    process.exit(1);
  }
}

/** Refuses to delete a `demo` org that this script did not create. */
async function assertSafeToReplace(prisma) {
  const existing = await prisma.organization.findUnique({
    where: { subdomain: DEMO_SLUG },
    include: { tenantUsers: { select: { email: true } } },
  });
  if (!existing) return;
  const strangers = existing.tenantUsers
    .map((u) => u.email.toLowerCase())
    .filter((e) => e !== REVIEWER_EMAIL && !e.endsWith('.invalid'));
  if (existing.name !== DEMO_NAME || strangers.length > 0) {
    console.error(
      `Refusing to replace the existing "${DEMO_SLUG}" org: it is named "${existing.name}"` +
        (strangers.length ? ` and has officers ${strangers.join(', ')}` : '') +
        `. This script only replaces "${DEMO_NAME}" with demo officers.`
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------- Sample receipt image

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** A plain "receipt" picture (header band in `accent`, grey text lines), as a data URL. */
function receiptDataUrl(accent) {
  const w = 180;
  const h = 260;
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) {
      let rgb = [255, 255, 255];
      if (y < 40) rgb = accent;
      else if (y >= 60 && y < 230 && (y - 60) % 22 < 6 && x >= 16 && x < (y > 200 ? 110 : 164)) rgb = [203, 213, 225];
      else if (y >= 236 && y < 244 && x >= 100 && x < 164) rgb = [22, 163, 74];
      rgb.forEach((v, i) => (row[1 + x * 3 + i] = v));
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour RGB
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

const CHANNEL_COLOURS = { GCash: [0, 112, 224], Maya: [16, 185, 129], 'Bank Transfer': [15, 23, 42] };

// ---------------------------------------------------------------- Seed

async function seed(prisma) {
  await prisma.organization.deleteMany({ where: { subdomain: DEMO_SLUG } });
  await prisma.authThrottle.deleteMany({ where: { key: { startsWith: `otp:${DEMO_SLUG}:` } } });

  const org = await prisma.organization.create({
    data: { subdomain: DEMO_SLUG, name: DEMO_NAME, type: 'Organization', activeAy: AY, activeTerm: TERM },
  });

  const officer = await prisma.tenantUser.create({
    data: {
      organizationId: org.id,
      userId: 'USR-DEMO-001',
      fullName: 'Demo Reviewer',
      username: 'demo-reviewer',
      email: REVIEWER_EMAIL,
      role: 'treasurer',
      allowedTabs: JSON.stringify(TREASURER_TABS),
      status: 'Active',
    },
  });

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

  const day = 24 * 60 * 60 * 1000;
  let or = 0;
  const students = [];
  for (const [i, [fullName, yearLevel, payments]] of STUDENTS.entries()) {
    // No student emails: recording a payment would otherwise email a receipt.
    const student = await prisma.student.create({
      data: { organizationId: org.id, studentId: studentNo(i + 1), fullName, yearLevel, email: null },
    });
    students.push(student);
    await prisma.enrollment.create({
      data: {
        organizationId: org.id,
        studentId: student.id,
        academicYear: AY,
        term: TERM,
        enrollmentStatus: 'Enrolled',
        updatedBy: 'seed-demo',
      },
    });

    for (const [feeName, paid] of payments) {
      const fee = FEES.find((f) => f.name === feeName);
      const date = new Date(Date.now() - (20 - or) * day);
      await prisma.collection.create({
        data: {
          organizationId: org.id,
          academicYear: AY,
          term: TERM,
          timestamp: date,
          date,
          studentId: student.id,
          studentName: fullName,
          orNumber: `DEMO-${String(++or).padStart(4, '0')}`,
          category: fee.category,
          itemDescription: fee.name,
          paymentType: paid >= fee.amount ? 'Full Payment' : 'Partial Payment',
          standardRate: fee.amount,
          amountPaid: paid,
          balanceDue: Math.max(0, fee.amount - paid),
          fundAllocation: fee.targetFund,
          status: 'Valid',
          encodedBy: officer.fullName,
        },
      });
    }
  }

  await prisma.penalty.create({
    data: {
      organizationId: org.id,
      penaltyId: 'PEN-DEMO-0001',
      academicYear: AY,
      term: TERM,
      studentId: students[9].studentId,
      studentName: students[9].fullName,
      activity: 'General Assembly (late)',
      hoursLate: 2,
      ratePerHour: 50,
      fineAmount: 100,
      status: 'Unsettled',
      encodedBy: officer.fullName,
    },
  });

  for (const [n, channel, feeName, amount] of PROOFS) {
    const s = students[n - 1];
    await prisma.onlineRemittance.create({
      data: {
        organizationId: org.id,
        submissionId: `SUB-DEMO-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        timestamp: new Date(Date.now() - (PROOFS.length - n + 7) * 60 * 60 * 1000),
        academicYear: AY,
        term: TERM,
        studentId: s.studentId,
        studentName: s.fullName,
        studentEmail: null,
        paymentChannel: channel,
        referenceNumber: `DEMO${String(n).padStart(3, '0')}${crypto.randomInt(100000, 999999)}`,
        category: 'Online Remittance',
        itemDescription: feeName,
        paymentMode: 'Online',
        amountPaid: amount,
        proofUrl: receiptDataUrl(CHANNEL_COLOURS[channel]),
        status: 'Pending Verification',
      },
    });
  }

  await prisma.signatory.createMany({
    data: [
      { organizationId: org.id, label: 'Prepared by:', name: 'Demo Reviewer', position: 'Treasurer', order: 1 },
      { organizationId: org.id, label: 'Approved:', name: 'Sample Adviser', position: 'Adviser', order: 2 },
    ],
  });

  await prisma.systemLog.create({
    data: { organizationId: org.id, user: 'seed-demo', action: 'DEMO_SEED', details: 'Demo organization created with sample data.' },
  });

  return { org, officer };
}

async function main() {
  const host = dbHost();
  if (!host) {
    console.error('DATABASE_URL is not set. Pass an env file, e.g. node --env-file=.env prisma/seed-demo.js');
    process.exit(1);
  }
  await confirm(host);

  const prisma = new PrismaClient();
  try {
    await assertSafeToReplace(prisma);
    const { org, officer } = await seed(prisma);
    console.log(`\n${org.name}  (/department/${org.subdomain})`);
    console.log(`  ${officer.role.padEnd(9)} ${officer.email}`);
    console.log(`  ${STUDENTS.length} students (${studentNo(1)} to ${studentNo(STUDENTS.length)}), ${PROOFS.length} pending proofs`);
    console.log(
      '\nSign-in works only while DEMO_REVIEWER_EMAIL and DEMO_REVIEWER_CODE are set on the server,\n' +
        `and DEMO_REVIEWER_EMAIL there must be ${REVIEWER_EMAIL}.\n`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
