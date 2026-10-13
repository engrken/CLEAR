'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import nodemailer from 'nodemailer';
import { auth } from '@/auth';
import { logSystemAction } from '@/lib/logger';
import { requireTabAccess, requireSuperAdmin } from '@/lib/permissions';

// =========================================================================
// GENERAL HELPERS (Optimized)
// =========================================================================

function formatDate(date: Date) {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function normalizeDepartment(dept: string) {
  const clean = String(dept || '').trim().toLowerCase();
  if (!clean) throw new Error('Department is required.');
  return clean;
}

function parseAllowedTabs(val: unknown): string[] {
  try {
    const arr = Array.isArray(val) ? val : JSON.parse(String(val));
    return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === 'string') : [];
  } catch { return []; }
}

function parseDate(val: string, field: string) {
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ${field}.`);
  return d;
}

function money(val: unknown, field = 'Amount') {
  const amt = Number(val);
  if (!Number.isFinite(amt)) throw new Error(`${field} must be a valid number.`);
  if (amt < 0) throw new Error(`${field} cannot be negative.`);
  return Math.round(amt * 100) / 100;
}

function generateReference(prefix: string) {
  return `${prefix}-${formatDate(new Date())}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function isVoidedRecord(row: { paymentType?: unknown; status?: unknown }) {
  const pt = String(row.paymentType || '').toUpperCase(), st = String(row.status || '').toUpperCase();
  return pt.includes('VOID') || st.includes('VOID') || st.includes('CANCEL');
}

function getStudentKey(dbId?: unknown, name?: unknown, fallback = '') {
  const id = String(dbId || '').trim().toLowerCase(), n = String(name || '').trim().toLowerCase();
  return id ? `ID:${id}` : n ? `NAME:${n}` : fallback;
}

function normalizeItemKey(val: unknown) {
  return String(val || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// =========================================================================
// ORGANIZATION / TENANT (Optimized)
// =========================================================================

async function resolveOrganizationId(department: string) {
  const org = await prisma.organization.findUnique({ where: { subdomain: normalizeDepartment(department) }, select: { id: true } });
  if (!org) throw new Error('Department organization not found.');
  return org.id;
}

async function requireOrganizationAccess(organizationId: string) {
  const email = String((await auth())?.user?.email || '').trim().toLowerCase();
  if (!email) throw new Error('401 Unauthorized: Session expired or missing email.');
  const user = await prisma.tenantUser.findFirst({ where: { organizationId, email, status: 'Active' } });
  if (!user) throw new Error('403 Forbidden: You do not have access to this department.');
  return user;
}

async function getOrgId(department: string) {
  const orgId = await resolveOrganizationId(department);
  await requireOrganizationAccess(orgId);
  return orgId;
}

async function getActionUser(): Promise<string> {
  const user = (await auth())?.user as { fullName?: string; email?: string } | undefined;
  return user?.fullName || user?.email || 'System';
}

// =========================================================================
// DEPARTMENT PROVISIONING (Optimized)
// =========================================================================

export async function saveSignatories(orgId: string, department: string, signatories: any[]) {
  await prisma.$transaction(async (tx) => {
    await tx.signatory.deleteMany({ where: { organizationId: orgId } });
    if (signatories.length > 0) {
      await tx.signatory.createMany({
        data: signatories.map((sig, order) => ({ organizationId: orgId, label: sig.label, name: sig.name, position: sig.position, order }))
      });
    }
  });
  ['summary', 'liquidations'].forEach(p => revalidatePath(`/department/${department}/${p}`));
  return { success: true };
}

export async function createDepartment(formData: FormData) {
  await requireSuperAdmin();
  const name = String(formData.get('name') || '').trim();
  const subdomain = String(formData.get('subdomain') || '').trim().toLowerCase();
  if (!name || !subdomain) throw new Error('Department name and subdomain are required.');
  if (!/^[a-z0-9-]+$/.test(subdomain)) throw new Error('Subdomain may contain only lowercase letters, numbers, and hyphens.');

  try {
    await prisma.organization.create({ data: { name, subdomain } });
    ['/', '/dashboard'].forEach(revalidatePath);
    return { success: true, message: `Department '${name}' successfully registered!` };
  } catch (error) {
    return { success: false, message: 'Subdomain already exists or could not be created.' };
  }
}

// =========================================================================
// COLLECTION (Optimized)
// =========================================================================

async function validateStudentOwnership(organizationId: string, studentDbId?: string | null) {
  const id = String(studentDbId || '').trim();
  if (!id) return null;
  const student = await prisma.student.findFirst({ where: { id, organizationId }, select: { id: true, studentId: true, fullName: true, email: true } });
  if (!student) throw new Error('Selected student does not belong to this department.');
  return student;
}

async function getPreviouslyPaid(organizationId: string, studentId: string | null | undefined, studentName: string, academicYear: string, term: string, itemDesc: string) {
  if (!String(itemDesc || '').trim()) return 0;
  const rows = await prisma.collection.findMany({
    where: { organizationId, academicYear, term, itemDescription: String(itemDesc).trim(), ...(studentId ? { studentId } : { studentId: null, studentName: String(studentName || '').trim() }) },
    select: { amountPaid: true, paymentType: true, status: true },
  });
  return rows.filter((r) => !isVoidedRecord(r)).reduce((s, r) => s + (Number(r.amountPaid) || 0), 0);
}

export async function recordCollection(department: string, data: any) {
  await requireTabAccess('tab-payment');
  const [officerName, orgId] = await Promise.all([getActionUser(), getOrgId(department)]);
  
  const studentDbId = String(data.studentId || '').trim() || null;
  await validateStudentOwnership(orgId, studentDbId);

  const [paid, rate, itemDesc] = [money(data.amountPaid, 'Payment'), money(data.standardRate, 'Rate'), String(data.itemDescription || '').trim()];
  if (paid <= 0 || rate <= 0 || !itemDesc) throw new Error('Valid payment amount, standard rate, and item description are required.');

  const alreadyPaid = await getPreviouslyPaid(orgId, studentDbId, data.studentName, data.ay, data.term, itemDesc);
  const remaining = Math.max(0, Math.round((rate - alreadyPaid) * 100) / 100);
  
  if (remaining <= 0) throw new Error(`This assessment has already been fully paid at ₱${rate.toFixed(2)}.`);
  if (paid > remaining) throw new Error(`Payment ₱${paid.toFixed(2)} exceeds remaining balance of ₱${remaining.toFixed(2)}.`);

  const balanceDue = Math.max(0, Math.round((rate - (alreadyPaid + paid)) * 100) / 100);

  await prisma.collection.create({
    data: {
      organizationId: orgId, academicYear: data.ay, term: data.term, orNumber: String(data.orNumber || '').trim(),
      studentId: studentDbId, studentName: String(data.studentName || '').trim(), category: String(data.category || '').trim(),
      itemDescription: itemDesc, paymentType: balanceDue === 0 ? 'Full Payment' : (String(data.paymentType || '').trim() || 'Partial Payment'),
      standardRate: rate, amountPaid: paid, balanceDue, fundAllocation: String(data.fundAllocation || '').trim(), status: 'Valid', encodedBy: officerName
    },
  });

  await logSystemAction(orgId, officerName, 'RECORD_COLLECTION', `Collected ₱${paid.toFixed(2)} from ${data.studentName} for ${itemDesc} [OR: ${data.orNumber}].`);
  ['collections', 'clearance', ''].forEach(p => revalidatePath(`/department/${department}${p ? `/${p}` : ''}`));
}

// =========================================================================
// OTP LOGIN (Optimized)
// =========================================================================

export async function requestOtp(department: string, email: string) {
  const [cleanDept, cleanEmail] = [normalizeDepartment(department), String(email || '').trim().toLowerCase()];
  if (!cleanEmail.includes('@')) throw new Error('Please provide a valid email address.');

  const org = await prisma.organization.findUnique({ where: { subdomain: cleanDept } });
  if (!org) throw new Error('Department organization not found.');

  const user = await prisma.tenantUser.findFirst({ where: { organizationId: org.id, email: cleanEmail } });
  if (!user || user.status !== 'Active') throw new Error(user ? 'This account is currently inactive.' : 'This account is not registered.');

  const cookieStore = await cookies();
  const lockoutTime = Number.parseInt(cookieStore.get('fcu_lockout')?.value || '0', 10);
  if (lockoutTime && Date.now() < lockoutTime) throw new Error(`Account temporarily locked. Try again in ${Math.ceil((lockoutTime - Date.now()) / 60000)} min(s).`);

  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const hashedCode = crypto.createHash('sha256').update(otpCode).digest('hex');

  const [smtpUser, smtpPass] = [process.env.SMTP_USER, process.env.SMTP_PASS];
  if (!smtpUser || !smtpPass) throw new Error('Email service is not configured.');

  try {
    await nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT || 465), secure: true, auth: { user: smtpUser, pass: smtpPass } })
      .sendMail({ from: `"CLEAR System" <${smtpUser}>`, to: cleanEmail, subject: `[CLEAR System] OTP CODE FOR ${org.name.toUpperCase()}`, text: `Your 6-digit One-Time PIN is: ${otpCode}\n\nThis code expires in 5 minutes.` });
  } catch (e) { throw new Error('Failed to dispatch verification email.'); }

  const opts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 300 };
  ['hash', 'email', 'department', 'strikes'].forEach((k, i) => cookieStore.set(`fcu_otp_${k}`, [`${hashedCode}:${Date.now() + 300000}`, cleanEmail, cleanDept, '0'][i], opts));

  return { success: true, message: 'Verification code sent successfully.' };
}

export async function verifyOtp(department: string, email: string, submittedOtp: string) {
  const [cleanDept, cleanEmail, cleanOtp] = [normalizeDepartment(department), String(email || '').trim().toLowerCase(), String(submittedOtp || '').trim()];
  if (!/^\d{6}$/.test(cleanOtp)) throw new Error('Verification code must be exactly 6 digits.');

  const cookieStore = await cookies();
  const [otpC, emailC, deptC, strikesC] = ['hash', 'email', 'department', 'strikes'].map(k => cookieStore.get(`fcu_otp_${k}`));
  if (!otpC || !emailC || !deptC || emailC.value !== cleanEmail || deptC.value !== cleanDept) throw new Error('Invalid or expired verification session.');

  let strikes = Number.parseInt(strikesC?.value || '0', 10);
  const handleLockout = (msg: string) => { cookieStore.set('fcu_lockout', (Date.now() + 600000).toString(), { httpOnly: true, path: '/', maxAge: 600 }); throw new Error(msg); };
  if (strikes >= 5) handleLockout('Maximum attempts exceeded. Account locked for 10 minutes.');

  const [storedHash, expiryStr] = otpC.value.split(':');
  if (!storedHash || Date.now() > Number.parseInt(expiryStr, 10)) {
    ['hash', 'email', 'department', 'strikes'].forEach(k => cookieStore.delete(`fcu_otp_${k}`));
    throw new Error('Verification code has expired. Please request a new one.');
  }

  const submittedHash = crypto.createHash('sha256').update(cleanOtp).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(storedHash, 'utf8'), Buffer.from(submittedHash, 'utf8'))) {
    cookieStore.set('fcu_otp_strikes', (++strikes).toString(), { httpOnly: true, path: '/', maxAge: 300 });
    if (strikes >= 5) handleLockout('Maximum attempts exceeded. Account locked for 10 minutes.');
    throw new Error(`Invalid verification code. ${5 - strikes} attempt(s) remaining.`);
  }

  const user = await prisma.tenantUser.findFirst({ where: { organizationId: await resolveOrganizationId(cleanDept), email: cleanEmail, status: 'Active' } });
  if (!user) throw new Error('Account inactive or not found.');

  ['hash', 'email', 'department', 'strikes', 'lockout'].forEach(k => cookieStore.delete(`fcu_${k.includes('lockout') ? 'lockout' : 'otp_' + k}`));
  cookieStore.set('fcu_session', user.id, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 86400 });

  return { success: true, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, allowedTabs: parseAllowedTabs(user.allowedTabs) } };
}

// =========================================================================
// STUDENTS & TRANSFERS (Optimized)
// =========================================================================

export async function upsertStudent(department: string, data: { studentId: string; fullName: string; email: string }) {
  await requireTabAccess('tab-students');
  const [officerName, orgId] = await Promise.all([getActionUser(), getOrgId(department)]);
  const [sId, name, email] = [String(data.studentId || '').trim(), String(data.fullName || '').trim(), String(data.email || '').trim() || null];
  if (!sId || !name) throw new Error('Student ID and name are required.');

  const existing = await prisma.student.findFirst({ where: { organizationId: orgId, studentId: sId } });
  
  if (existing) await prisma.student.update({ where: { id: existing.id }, data: { fullName: name, email } });
  else await prisma.student.create({ data: { organizationId: orgId, studentId: sId, fullName: name, email, yearLevel: 'N/A' } });

  await logSystemAction(orgId, officerName, existing ? 'UPDATE_STUDENT' : 'ADD_STUDENT', `${existing ? 'Modified' : 'Registered'} profile for ${name} (${sId}).`);
  ['students', 'clearance'].forEach(p => revalidatePath(`/department/${department}/${p}`));
}

export async function deleteStudent(department: string, studentId: string) {
  await requireTabAccess('tab-students');
  const [officerName, orgId, sId] = [await getActionUser(), await getOrgId(department), String(studentId || '').trim()];
  if (!sId) throw new Error('Student ID is required.');

  const existing = await prisma.student.findFirst({ where: { organizationId: orgId, studentId: sId } });
  if (existing) {
    await prisma.student.delete({ where: { id: existing.id } });
    await logSystemAction(orgId, officerName, 'DELETE_STUDENT', `Permanently removed student record for ${existing.fullName} (${existing.studentId}).`);
  }
  ['students', 'clearance'].forEach(p => revalidatePath(`/department/${department}/${p}`));
}

export async function transferFunds(department: string, data: { fromFund: string; toFund: string; amount: number; reason: string; ay: string; term: string }) {
  await requireTabAccess('tab-transfer');
  const [officerName, orgId] = await Promise.all([getActionUser(), getOrgId(department)]);
  const [from, to, amt] = [String(data.fromFund || '').trim(), String(data.toFund || '').trim(), money(data.amount, 'Transfer amount')];

  if (!from || !to || from.toLowerCase() === to.toLowerCase()) throw new Error('Source and destination funds must be distinct and provided.');
  if (amt <= 0) throw new Error('Transfer amount must be greater than zero.');

  await prisma.fundTransfer.create({ data: { organizationId: orgId, academicYear: data.ay, term: data.term, sourceFund: from, destinationFund: to, amount: amt, reason: String(data.reason || '').trim(), encodedBy: officerName } });
  await logSystemAction(orgId, officerName, 'TRANSFER_FUNDS', `Realigned ₱${amt.toFixed(2)} from ${from} to ${to}.`);
  ['realign', ''].forEach(p => revalidatePath(`/department/${department}${p ? `/${p}` : ''}`));
}

export async function updateMyEmail(department: string, newEmail: string) {
  const sessionUser = (await auth())?.user as { email?: string } | undefined;
  if (!sessionUser?.email) throw new Error('Unauthorized: No active session found.');
  
  const [orgId, currentEmail, cleanNewEmail] = [await getOrgId(department), sessionUser.email.trim().toLowerCase(), String(newEmail || '').trim().toLowerCase()];
  if (!cleanNewEmail.includes('@')) throw new Error('Please provide a valid email address.');

  const user = await prisma.tenantUser.findFirst({ where: { organizationId: orgId, email: currentEmail } });
  if (!user) throw new Error('User record not found in this department.');

  const existing = await prisma.tenantUser.findFirst({ where: { organizationId: orgId, email: cleanNewEmail } });
  if (existing && existing.id !== user.id) throw new Error('This email is already registered by another account.');

  await prisma.tenantUser.update({ where: { id: user.id }, data: { email: cleanNewEmail } });
  revalidatePath(`/department/${department}`);
  return { success: true, message: 'Email updated! Please sign out and back in.' };
}

// =========================================================================
// FINANCIAL ENGINE (Optimized)
// =========================================================================

export async function getDepartmentFinancials(organizationId: string, ay: string, term: string, isPublic: boolean = false) {
  if (!isPublic) await requireOrganizationAccess(organizationId);

  const [
    collections, audits, cashAdvances, explicitCollectibles, initialFunds,
    students, enrollments, collectionSetups, fundTransfers, cashierRecords
  ] = await Promise.all([
    prisma.collection.findMany({ where: { organizationId, academicYear: ay, term }, include: { student: { select: { id: true, studentId: true, fullName: true } } } }),
    prisma.audit.findMany({ where: { organizationId, academicYear: ay, term } }),
    prisma.cashAdvance.findMany({ where: { organizationId, academicYear: ay, term }, orderBy: { dateIssued: 'desc' } }),
    prisma.collectible.findMany({ where: { organizationId, academicYear: ay, term } }),
    prisma.fund.findMany({ where: { organizationId, academicYear: ay, term } }),
    prisma.student.findMany({ where: { organizationId } }),
    prisma.enrollment.findMany({ where: { organizationId, academicYear: ay, term }, include: { student: { select: { id: true, studentId: true, fullName: true } } } }),
    prisma.collectionSetup.findMany({ where: { organizationId, academicYear: ay, term } }),
    prisma.fundTransfer.findMany({ where: { organizationId, academicYear: ay, term } }),
    prisma.cashierRemittance.findMany({ where: { organizationId, academicYear: ay, term, status: "Remitted" } }), // 🚀 Safekeeping Fetch
  ]);

  // 1. SAFEKEEPING MATH
  const totalDeposited = cashierRecords.filter(r => r.type === "Deposit").reduce((s, r) => s + (r.amount || 0), 0);
  const totalWithdrawn = cashierRecords.filter(r => r.type === "Withdrawal").reduce((s, r) => s + (r.amount || 0), 0);
  const cashierBalance = totalDeposited - totalWithdrawn;

  // 2. VALIDATION & HELPERS
  const validCollections = collections.filter((c: any) => !isVoidedRecord(c));
  const validAudits = audits.filter((a: any) => !String(a.status || '').toUpperCase().match(/VOID|CANCEL/));
  const getFundName = (row: any) => [row.fundAllocation, row.fundSource, row.fundName, row.fund].find(f => f && String(f).trim() !== 'undefined' && String(f).trim() !== 'null') || 'General Fund (Carried Over)';

  // 3. PACKAGES
  const legacyPkgs: any = {
    '1st Sem': { total: 650, items: [{name: 'JIECEP FCUSC Membership Fee (Student & Institutional)', rate: 250, fund: 'JIECEP Membership Fund'}, {name: 'General Orientation/Acquaintance Party', rate: 200, fund: 'General Orientation Fund'}, {name: 'COE FCUSR Activities', rate: 100, fund: 'FCUSR Activities Fund'}, {name: 'Sports and Cultural Fund', rate: 100, fund: 'Sports & Cultural Fund'}] },
    '2nd Sem': { total: 900, items: [{name: 'JIECEP FCUSC Fund', rate: 50, fund: 'JIECEP FCUSC Fund'}, {name: 'JIECEP Week Activities (Local & Regional)', rate: 150, fund: 'JIECEP Week Activities Fund'}, {name: 'ECE Grand Ball', rate: 650, fund: 'ECE Grandball Fund'}, {name: 'Emergency/Calamity Fund', rate: 30, fund: 'Emergency/Calamity Fund'}, {name: 'FCUSR Activities & Projects', rate: 20, fund: 'FCUSR Activities Fund'}] },
    'Summer': { total: 200, items: [{name: 'Summer Departmental Operations', rate: 150, fund: 'New Accounts (Current Operations)'}, {name: 'Special Activities Fund', rate: 50, fund: 'JIECEP Activities Fund'}] }
  };

  const pkgItems = collectionSetups.filter((c: any) => c.isPackage !== false);
  const termPkg = pkgItems.length > 0
    ? { total: pkgItems.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0), items: pkgItems.map((s: any) => ({ name: String(s.name||'').trim(), rate: Number(s.amount)||0, fund: String(s.targetFund||'').trim() })) }
    : (legacyPkgs[term] || legacyPkgs['1st Sem']);

  // 4. COLLECTIONS & MATCHING
  let grandCollectionTotal = 0;
  const collectionHierarchy: Record<string, { count: number; total: number }> = {};
  const distinctStudents: Record<string, Set<string>> = {};
  const collectionsByFund: Record<string, number> = {};
  
  const paidByDbStudentId: Record<string, number> = {};
  const paidByStudentNumber: Record<string, number> = {};
  const paidByUniqueStudentName: Record<string, number> = {};

  const studentsByDbId = new Map(students.map((s: any) => [String(s.id).toLowerCase(), s]));
  const studentsByStudentNumber = new Map(students.filter((s:any) => s.studentId).map((s: any) => [String(s.studentId).toLowerCase(), s]));
  const studentNameCounts = new Map<string, number>();
  
  students.forEach((s: any) => {
    const name = String(s.fullName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (name) studentNameCounts.set(name, (studentNameCounts.get(name) || 0) + 1);
  });

  const addCollectionItem = (name: string, amt: number, key: string, fund: string) => {
    grandCollectionTotal += amt;
    collectionsByFund[fund] = (collectionsByFund[fund] || 0) + amt;
    if (!collectionHierarchy[name]) { collectionHierarchy[name] = { count: 0, total: 0 }; distinctStudents[name] = new Set(); }
    collectionHierarchy[name].total += amt;
    if (amt > 0 && key) distinctStudents[name].add(key);
  };

  const obligationGroups = new Map<string, any>();

  validCollections.forEach((c: any) => {
    const desc = String(c.itemDescription || c.category || 'General').trim();
    const descLower = desc.toLowerCase();
    const amt = Number(c.amountPaid) || 0;
    const fund = getFundName(c);
    const studentKey = getStudentKey(c.studentId || c.student?.id, c.student?.fullName || c.studentName, String(c.orNumber || '').trim().toLowerCase());
    
    const matchedPkgItem = termPkg.items.find((pi: any) => String(pi.name).trim().toLowerCase() === descLower);
    const isDepPkg = ['departmental fee package', 'departmental fee', 'departmental fee package (all items)'].includes(descLower);

    if (matchedPkgItem) {
      addCollectionItem(matchedPkgItem.name, amt, studentKey, matchedPkgItem.fund);
    } else if (isDepPkg) {
      const pkgTotalRate = Number(termPkg.total) || 0;
      if (pkgTotalRate > 0) termPkg.items.forEach((pi: any) => addCollectionItem(pi.name, (Number(pi.rate) / pkgTotalRate) * amt, studentKey, pi.fund));
      else addCollectionItem(desc, amt, studentKey, fund);
    } else {
      addCollectionItem(desc, amt, studentKey, fund);
    }

    // Package payment tracking
    if ((matchedPkgItem || isDepPkg) && amt > 0) {
      const relId = String(c.student?.id || '').toLowerCase();
      const rawRef = String(c.studentId || '').toLowerCase();
      const uniqueName = String(c.student?.fullName || c.studentName || '').trim().toLowerCase().replace(/\s+/g, ' ');
      
      if (relId && studentsByDbId.has(relId)) paidByDbStudentId[relId] = (paidByDbStudentId[relId] || 0) + amt;
      else if (rawRef && studentsByDbId.has(rawRef)) paidByDbStudentId[rawRef] = (paidByDbStudentId[rawRef] || 0) + amt;
      else if (rawRef && studentsByStudentNumber.has(rawRef)) paidByStudentNumber[rawRef] = (paidByStudentNumber[rawRef] || 0) + amt;
      else if (uniqueName && studentNameCounts.get(uniqueName) === 1) paidByUniqueStudentName[uniqueName] = (paidByUniqueStudentName[uniqueName] || 0) + amt;
    }

    // Non-package obligation tracking
    if (!matchedPkgItem && !isDepPkg) {
      const itemName = desc || String(c.category || '').trim() || 'Other Due';
      const groupKey = `${studentKey}|${itemName.trim().toLowerCase()}`;
      const existing = obligationGroups.get(groupKey) || { studentKey, itemName, assessedAmount: 0, paidAmount: 0, hasOutstandingMarker: false };
      existing.assessedAmount = Math.max(existing.assessedAmount, Number(c.standardRate) || 0);
      existing.paidAmount += amt;
      existing.hasOutstandingMarker = existing.hasOutstandingMarker || (Number(c.balanceDue) > 0 || String(c.paymentType).toLowerCase().includes('unpaid') || String(c.orNumber).toUpperCase().startsWith('DUE-'));
      obligationGroups.set(groupKey, existing);
    }
  });

  Object.keys(collectionHierarchy).forEach(key => collectionHierarchy[key].count = distinctStudents[key]?.size || 0);

  // 5. EXPENSES & ADVANCES
  const expensesByFund: Record<string, number> = {};
  const grandExpenseTotal = validAudits.reduce((sum, a: any) => {
    const amt = Number(a.totalExpense) || 0;
    const fund = getFundName(a);
    expensesByFund[fund] = (expensesByFund[fund] || 0) + amt;
    return sum + amt;
  }, 0);

  let totalUnliquidated = 0;
  const unliquidatedByFund: Record<string, number> = {};
  const unliquidatedAdvances = cashAdvances.filter((ca: any) => {
    const status = String(ca.status || '').toUpperCase();
    return (status.includes('PENDING') || status.includes('UNLIQUIDATED') || status === 'ACTIVE') && !status.includes('CANCEL') && !status.includes('LIQUIDATED');
  }).map((ca: any) => {
    const amt = Number(ca.amountApproved) || 0;
    const fund = getFundName(ca);
    totalUnliquidated += amt;
    unliquidatedByFund[fund] = (unliquidatedByFund[fund] || 0) + amt;
    return { id: ca.advanceId, date: ca.dateIssued ? new Date(ca.dateIssued).toISOString().split('T')[0] : '', requestor: ca.requestor, fund, amount: amt, due: ca.expectedReturnDate ? new Date(ca.expectedReturnDate).toISOString().split('T')[0] : '', status: ca.status };
  });

  // 6. COLLECTIBLES
  const collectiblesMap: Record<string, { category: string; headcount: number; total: number }> = {};
  let totalPackageReceivable = 0;
  let unpaidOrPartialPackageCount = 0;

  const packageStudentMap = new Map(students.map((s: any) => [String(s.id), s]));
  enrollments.filter((e: any) => !['DROPPED', 'CANCELLED', 'INACTIVE'].includes(String(e.enrollmentStatus || '').toUpperCase())).forEach((e: any) => e.student?.id && packageStudentMap.set(String(e.student.id), e.student));

  Array.from(packageStudentMap.values()).forEach((s: any) => {
    if (!s?.id) return;
    const dbId = String(s.id).toLowerCase();
    const sNum = String(s.studentId || '').toLowerCase();
    const sName = String(s.fullName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    
    let remitted = paidByDbStudentId[dbId] ?? paidByStudentNumber[sNum] ?? (studentNameCounts.get(sName) === 1 ? paidByUniqueStudentName[sName] : 0) ?? 0;
    const remaining = Math.max(0, Math.round((termPkg.total - (Math.round(remitted * 100) / 100)) * 100) / 100);
    
    if (remaining > 0) {
      unpaidOrPartialPackageCount++;
      totalPackageReceivable += remaining;
    }
  });

  if (unpaidOrPartialPackageCount > 0) collectiblesMap[`Unsettled Departmental Fees (${term})`] = { category: `Unsettled Departmental Fees (${term})`, headcount: unpaidOrPartialPackageCount, total: Math.round(totalPackageReceivable * 100) / 100 };

  const explicitCollectibleItemKeys = new Set(explicitCollectibles.map((ec: any) => normalizeItemKey((String(ec.category || '').startsWith('Arrears: ') ? String(ec.category).substring(9).split(' - ')[0] : ec.category) || 'Unassigned')));

  obligationGroups.forEach(group => {
    const remaining = Math.max(0, Math.round((group.assessedAmount - group.paidAmount) * 100) / 100);
    if ((remaining > 0 || group.hasOutstandingMarker) && !explicitCollectibleItemKeys.has(normalizeItemKey(group.itemName))) {
      if (!collectiblesMap[group.itemName]) collectiblesMap[group.itemName] = { category: group.itemName, headcount: 0, total: 0 };
      collectiblesMap[group.itemName].headcount++;
      collectiblesMap[group.itemName].total += remaining > 0 ? remaining : group.assessedAmount;
    }
  });

  explicitCollectibles.forEach((ec: any) => {
    const rawCat = String(ec.category || 'Unassigned').trim();
    const itemName = rawCat.startsWith('Arrears: ') ? (rawCat.substring(9).split(' - ')[0] || rawCat) : rawCat;
    if (!collectiblesMap[itemName]) collectiblesMap[itemName] = { category: itemName, headcount: 0, total: 0 };
    collectiblesMap[itemName].headcount += Number(ec.headcount) || 1;
    collectiblesMap[itemName].total += Number(ec.balanceDue) || 0;
  });

  const collectiblesList = Object.values(collectiblesMap);
  const totalCollectiblesSum = collectiblesList.reduce((sum, c) => sum + c.total, 0);

  // 7. FUNDS, TRANSFERS & BALANCES
  const initialAllocMap = initialFunds.reduce((acc: any, f: any) => { const n = String(f.fundName || '').trim(); if (n) acc[n] = (acc[n] || 0) + (Number(f.initialAllocation) || 0); return acc; }, {});
  const totalInitialAlloc = Object.values(initialAllocMap).reduce((s: number, a: number) => s + a, 0);

  let carryOverInboundTotal = 0;
  const transferEffects = fundTransfers.reduce((acc: any, t: any) => {
    const amt = Number(t.amount) || 0;
    if (amt > 0) {
      const src = String(t.sourceFund || '').trim(), dst = String(t.destinationFund || '').trim();
      if (src.toLowerCase().includes('rollover')) { if (dst) acc[dst] = (acc[dst] || 0) + amt; carryOverInboundTotal += amt; } 
      else { if (src) acc[src] = (acc[src] || 0) - amt; if (dst) acc[dst] = (acc[dst] || 0) + amt; }
    }
    return acc;
  }, {});

  const fundsList = Array.from(new Set([...Object.keys(collectionsByFund), ...Object.keys(expensesByFund), ...Object.keys(initialAllocMap), ...Object.keys(unliquidatedByFund), ...Object.keys(transferEffects)]))
    .sort((a, b) => a.localeCompare(b))
    .map(name => ({
      name, collected: collectionsByFund[name] || 0, spent: expensesByFund[name] || 0, unliquidated: unliquidatedByFund[name] || 0,
      balance: (initialAllocMap[name] || 0) + (collectionsByFund[name] || 0) - (expensesByFund[name] || 0) - (unliquidatedByFund[name] || 0) + (transferEffects[name] || 0)
    }));

  const remainingBalance = totalInitialAlloc + grandCollectionTotal - grandExpenseTotal - totalUnliquidated + carryOverInboundTotal;

  // 8. FINAL RETURN
  return {
    grandCollectionTotal, grandExpenseTotal, totalUnliquidated, totalCollectibles: totalCollectiblesSum,
    remainingBalance, unliquidatedAdvances, collectionHierarchy, expensesByFund, collectiblesList, fundsList, termPkg,
    cashierBalance, totalDeposited, totalWithdrawn
  };
}
// =========================================================================
// COLLECTION SETUP (Optimized)
// =========================================================================

export async function saveCollectionSetupItem(department: string, p: { category: string; name: string; amount: number; targetFund: string; isPackage: boolean; ay: string; term: string; }) {
  await requireTabAccess('tab-setup');
  const orgId = await getOrgId(department);

  const [name, category, targetFund, amount] = [String(p.name || '').trim(), String(p.category || '').trim(), String(p.targetFund || '').trim(), money(p.amount, 'Collection setup amount')];
  if (!name || !targetFund) throw new Error('Collection setup name and target fund are required.');

  const updateData = { category, amount, targetFund, isPackage: Boolean(p.isPackage) };
  const existing = await prisma.collectionSetup.findFirst({ where: { organizationId: orgId, academicYear: p.ay, term: p.term, name } });

  if (existing) {
    await prisma.collectionSetup.update({ where: { id: existing.id }, data: updateData });
  } else {
    await prisma.collectionSetup.create({ data: { organizationId: orgId, academicYear: p.ay, term: p.term, name, ...updateData } });
  }

  ['setup/collections', 'collections', 'reports', 'clearance', ''].forEach(path => revalidatePath(`/department/${department}${path ? `/${path}` : ''}`));
  return { success: true, message: `Configured '${name}' successfully.` };
}

export async function deleteCollectionSetupItem(department: string, setupId: string) {
  await requireTabAccess('tab-setup');
  
  // 🚀 Optimized: Performs a targeted delete and checks the result in a single DB query
  const result = await prisma.collectionSetup.deleteMany({ where: { id: setupId, organizationId: await getOrgId(department) } });
  if (result.count === 0) throw new Error('Collection setup item not found or already removed.');

  ['setup/collections', 'collections', 'reports', 'clearance', ''].forEach(path => revalidatePath(`/department/${department}${path ? `/${path}` : ''}`));
  return { success: true, message: 'Configuration item removed successfully.' };
}