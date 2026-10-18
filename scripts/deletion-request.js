// /scripts/deletion-request.js
//
// Carries out an account or data deletion request (see /account-deletion).
//
//   officer  Deactivates an officer in one organization: status Inactive, any
//            pending sign-in code cleared, every live mobile session revoked.
//            --erase-contact also replaces their email and username with
//            placeholders (their name stays on the records they encoded).
//   proofs   Deletes the payment proof images of one student in one organization.
//            Only remittances that were already verified or invalidated are
//            touched; pending ones are listed and left alone.
//
// Usage:
//   node --env-file=<env file> scripts/deletion-request.js officer --org <slug> --email <email> [--erase-contact]
//   node --env-file=<env file> scripts/deletion-request.js proofs  --org <slug> --student <student ID>
//
// Shows what it will change and asks you to type the database host first.
// --yes skips that prompt, for a local database only (the test suite uses it).

const readline = require('node:readline/promises');
const { PrismaClient } = require('@prisma/client');

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];
const ACTOR = 'deletion-request';

function usage(message) {
  if (message) console.error(`${message}\n`);
  console.error(
    'Usage:\n' +
      '  node --env-file=<env file> scripts/deletion-request.js officer --org <slug> --email <email> [--erase-contact]\n' +
      '  node --env-file=<env file> scripts/deletion-request.js proofs  --org <slug> --student <student ID>'
  );
  process.exit(2);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = { command, flags: new Set() };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (['--org', '--email', '--student'].includes(a)) {
      if (!rest[i + 1] || rest[i + 1].startsWith('--')) usage(`${a} needs a value.`);
      opts[a.slice(2)] = rest[++i].trim();
    } else if (['--erase-contact', '--yes'].includes(a)) {
      opts.flags.add(a);
    } else {
      usage(`Unknown argument ${a}.`);
    }
  }
  if (!['officer', 'proofs'].includes(command)) usage();
  if (!opts.org) usage('--org is required.');
  if (command === 'officer' && !opts.email) usage('--email is required.');
  if (command === 'proofs' && !opts.student) usage('--student is required.');
  return opts;
}

function dbHost() {
  try {
    return new URL(process.env.DATABASE_URL || '').hostname;
  } catch {
    return '';
  }
}

async function confirm(host, flags) {
  if (LOCAL_HOSTS.includes(host) && flags.has('--yes')) return;
  if (!process.stdin.isTTY) {
    console.error('Refusing to run without a terminal to confirm in (--yes only works for a local database).');
    process.exit(1);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(`\nType the database host to apply these changes (${host}): `)).trim();
  rl.close();
  if (answer !== host) {
    console.error('Host did not match. Nothing was changed.');
    process.exit(1);
  }
}

async function findOrg(prisma, slug) {
  const org = await prisma.organization.findFirst({
    where: { subdomain: { equals: slug.toLowerCase(), mode: 'insensitive' } },
  });
  if (!org) {
    console.error(`No organization "${slug}".`);
    process.exit(1);
  }
  return org;
}

async function officerRequest(prisma, opts, host) {
  const org = await findOrg(prisma, opts.org);
  const email = opts.email.toLowerCase();
  const user = await prisma.tenantUser.findFirst({
    where: { organizationId: org.id, email: { equals: email, mode: 'insensitive' } },
  });
  if (!user) {
    console.error(`No officer ${email} in ${org.subdomain}.`);
    process.exit(1);
  }
  const now = new Date();
  const liveSessions = await prisma.mobileSession.count({
    where: { tenantUserId: user.id, revokedAt: null, expiresAt: { gt: now } },
  });
  const erase = opts.flags.has('--erase-contact');

  console.log(`Organization: ${org.name} (${org.subdomain})`);
  console.log(`Officer:      ${user.fullName} <${user.email}>, ${user.role}, ${user.status}`);
  console.log('Will:');
  console.log('  - set the account to Inactive and clear any pending sign-in code');
  console.log(`  - revoke ${liveSessions} live mobile session(s)`);
  if (erase) console.log('  - replace the email and username with placeholders');
  await confirm(host, opts.flags);

  const placeholder = `deleted-${user.id.slice(0, 8)}`;
  const [revoked] = await prisma.$transaction([
    prisma.mobileSession.updateMany({
      where: { tenantUserId: user.id, revokedAt: null },
      data: { revokedAt: now },
    }),
    prisma.tenantUser.update({
      where: { id: user.id },
      data: {
        status: 'Inactive',
        otpCode: null,
        otpExpires: null,
        ...(erase ? { email: `${placeholder}@deleted.invalid`, username: placeholder } : {}),
      },
    }),
    prisma.authThrottle.deleteMany({ where: { key: `otp:${org.subdomain}:${user.email.toLowerCase()}` } }),
    prisma.systemLog.create({
      data: {
        organizationId: org.id,
        user: ACTOR,
        action: 'DEACTIVATE_OFFICER',
        details: `Deactivated ${user.fullName} on request${erase ? ' and removed their contact details' : ''}; revoked mobile sessions.`,
      },
    }),
  ]);
  console.log(`\nDone: ${user.fullName} is Inactive; ${revoked.count} session row(s) marked revoked.`);
}

async function proofsRequest(prisma, opts, host) {
  const org = await findOrg(prisma, opts.org);
  const rows = await prisma.onlineRemittance.findMany({
    where: { organizationId: org.id, studentId: opts.student, proofUrl: { not: null } },
    select: { id: true, submissionId: true, status: true, referenceNumber: true },
    orderBy: { timestamp: 'asc' },
  });
  const isPending = (s) => !String(s || '').trim() || String(s).toLowerCase().includes('pending');
  const done = rows.filter((r) => !isPending(r.status));
  const pending = rows.filter((r) => isPending(r.status));

  console.log(`Organization: ${org.name} (${org.subdomain}); student ${opts.student}`);
  console.log(`Proof images to delete: ${done.length}`);
  for (const r of done) console.log(`  - ${r.submissionId} (${r.status}, ref ${r.referenceNumber})`);
  if (pending.length) {
    console.log(`Left alone, still pending review: ${pending.length}`);
    for (const r of pending) console.log(`  - ${r.submissionId} (ref ${r.referenceNumber})`);
  }
  if (done.length === 0) {
    console.log('\nNothing to delete.');
    return;
  }
  await confirm(host, opts.flags);

  const [cleared] = await prisma.$transaction([
    prisma.onlineRemittance.updateMany({
      where: { id: { in: done.map((r) => r.id) } },
      data: { proofUrl: null },
    }),
    prisma.systemLog.create({
      data: {
        organizationId: org.id,
        user: ACTOR,
        action: 'DELETE_PROOF_IMAGES',
        details: `Deleted ${done.length} payment proof image(s) of student ${opts.student} on request.`,
      },
    }),
  ]);
  console.log(`\nDone: ${cleared.count} proof image(s) deleted. The remittance records stay for the audit.`);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const host = dbHost();
  if (!host) usage('DATABASE_URL is not set. Pass an env file with --env-file.');
  console.log(`Database host: ${host}${LOCAL_HOSTS.includes(host) ? ' (local)' : ''}\n`);

  const prisma = new PrismaClient();
  try {
    if (opts.command === 'officer') await officerRequest(prisma, opts, host);
    else await proofsRequest(prisma, opts, host);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
