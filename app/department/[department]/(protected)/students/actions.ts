'use server';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireTabAccess } from '@/lib/permissions';
import { revalidatePath } from 'next/cache';

const str = (v: unknown) => String(v ?? '').trim();
const validTerm = (v: string, name: string) => {
  const value = str(v);
  if (!value || value.length > 80) throw new Error(`${name} is required.`);
  return value;
};
const actorName = (u: any) => str(u?.name || u?.fullName || u?.email) || 'Authorized Officer';

async function scope(department: string) {
  let dept = '';
  try { dept = decodeURIComponent(str(department)).toLowerCase(); }
  catch { throw new Error('Invalid department identifier.'); }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(dept)) throw new Error('Invalid department identifier.');
  const actor = await requireTabAccess('tab-students', dept);
  const org = await prisma.organization.findUnique({ where: { subdomain: dept }, select: { id: true } });
  if (!org) throw new Error('Organization not found.');
  if ((actor as any).organizationId && (actor as any).organizationId !== org.id && !(actor as any).isSuper) {
    throw new Error('Not authorized for this organization.');
  }
  return { dept, orgId: org.id, officer: actorName(actor) };
}

function refresh(dept: string) {
  for (const suffix of ['/students', '/clearance', '/reports', '/summary', '']) revalidatePath(`/department/${dept}${suffix}`);
}

async function enrollmentStatus(tx: Prisma.TransactionClient, studentId: string, orgId: string, ay: string, term: string, status: string, officer: string) {
  if (!['Enrolled', 'Inactive'].includes(status)) throw new Error('Invalid enrollment status.');
  await tx.enrollment.upsert({
    where: { organizationId_academicYear_term_studentId: { organizationId: orgId, academicYear: ay, term, studentId } },
    create: { organizationId: orgId, studentId, academicYear: ay, term, enrollmentStatus: status, updatedBy: officer },
    update: { enrollmentStatus: status, lastUpdated: new Date(), updatedBy: officer },
  });
}

export async function toggleStudentStatus(department: string, studentId: string, _currentStatus: string, ay: string, term: string) {
  const { dept, orgId, officer } = await scope(department);
  const academicYear = validTerm(ay, 'Academic year');
  const academicTerm = validTerm(term, 'Term');
  const result = await prisma.$transaction(async tx => {
    const student = await tx.student.findFirst({ where: { id: str(studentId), organizationId: orgId } });
    if (!student) throw new Error('Student not found in this organization.');
    const enrolled = await tx.enrollment.findUnique({
      where: { organizationId_academicYear_term_studentId: { organizationId: orgId, studentId: student.id, academicYear, term: academicTerm } },
    });
    const nextStatus = enrolled?.enrollmentStatus === 'Enrolled' ? 'Inactive' : 'Enrolled';
    await enrollmentStatus(tx, student.id, orgId, academicYear, academicTerm, nextStatus, officer);
    await tx.systemLog.create({ data: { organizationId: orgId, user: officer, action: 'TOGGLE_STUDENT_STATUS', details: `${student.studentId}: ${nextStatus} in ${academicYear} ${academicTerm}` } });
    return nextStatus;
  });
  refresh(dept);
  return { success: true, status: result };
}

export async function confirmAllEnrolled(department: string, _clientOrgId: string, ay: string, term: string) {
  const { dept, orgId, officer } = await scope(department);
  const academicYear = validTerm(ay, 'Academic year');
  const academicTerm = validTerm(term, 'Term');
  const count = await prisma.$transaction(async tx => {
    const students = await tx.student.findMany({ where: { organizationId: orgId }, select: { id: true } });
    for (const student of students) await enrollmentStatus(tx, student.id, orgId, academicYear, academicTerm, 'Enrolled', officer);
    await tx.systemLog.create({ data: { organizationId: orgId, user: officer, action: 'CONFIRM_ALL_ENROLLED', details: `${students.length} students confirmed enrolled in ${academicYear} ${academicTerm}` } });
    return students.length;
  }, { timeout: 60000 });
  refresh(dept);
  return { success: true, count };
}

/**
 * Deprecated bulk promotion endpoint, deliberately disabled.
 * Individual student selection is mandatory to avoid accidental mass promotion.
 */
export async function promoteYearLevels(_department: string, _clientOrgId: string) {
  throw new Error('Bulk year-level promotion is disabled. Select students in the roster and use Promote Selected.');
}

/**
 * Promote an explicitly selected set of students. No "promote all" fallback.
 * The caller's supplied organization ID is deliberately ignored.
 */
export async function promoteSelectedYearLevels(
  department: string,
  _clientOrgId: string,
  studentInternalIds: string[],
) {
  const { dept, orgId, officer } = await scope(department);
  if (!Array.isArray(studentInternalIds) || studentInternalIds.length === 0) {
    throw new Error('Select at least one student for year-level promotion.');
  }
  if (studentInternalIds.length > 200) {
    throw new Error('Promote at most 200 students in a single batch.');
  }
  const ids = studentInternalIds.map(str);
  if (ids.some(id => !id || id.length > 100) || new Set(ids).size !== ids.length) {
    throw new Error('Invalid or duplicate student selection.');
  }
  const advancement: Record<string, string> = {
    '1st Year': '2nd Year',
    '2nd Year': '3rd Year',
    '3rd Year': '4th Year',
    '4th Year': 'Graduated / Alumni',
  };

  const result = await prisma.$transaction(async tx => {
    const students = await tx.student.findMany({
      where: { organizationId: orgId, id: { in: ids } },
      select: { id: true, studentId: true, yearLevel: true },
    });
    if (students.length !== ids.length) {
      throw new Error('Selection contains a student outside this organization or a deleted record. Refresh the roster.');
    }
    const unsupported = students.filter(student => !advancement[student.yearLevel]);
    if (unsupported.length > 0) {
      throw new Error(`Cannot promote ${unsupported.length} selected student(s) with unassigned or graduated year levels. Refresh your selection.`);
    }
    const changes: string[] = [];
    for (const student of students) {
      const nextLevel = advancement[student.yearLevel];
      const updated = await tx.student.updateMany({
        where: { id: student.id, organizationId: orgId, yearLevel: student.yearLevel },
        data: { yearLevel: nextLevel },
      });
      if (updated.count !== 1) {
        throw new Error('A selected student year level changed during promotion. No records were promoted; refresh and retry.');
      }
      changes.push(`${student.studentId}: ${student.yearLevel} -> ${nextLevel}`);
    }
    await tx.systemLog.create({ data: {
      organizationId: orgId,
      user: officer,
      action: 'PROMOTE_SELECTED_YEAR_LEVELS',
      details: `Selected year-level promotion (${students.length}): ${changes.join('; ')}`,
    } });
    return students.length;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000 });
  refresh(dept);
  return { success: true, promoted: result };
}

export async function saveStudent(department: string, _clientOrgId: string, ay: string, term: string, formData: {
  id?: string; studentId: string; fullName: string; yearLevel: string; email?: string;
  enrollmentStatus?: string; isEdit: boolean; originalId?: string;
  // Recorded officer attestation is not proof of new mailbox ownership.
  emailChangeIdentityVerified?: boolean;
}) {
  const { dept, orgId, officer } = await scope(department);
  const academicYear = validTerm(ay, 'Academic year');
  const academicTerm = validTerm(term, 'Term');
  const studentId = str(formData?.studentId);
  const fullName = str(formData?.fullName);
  const yearLevel = str(formData?.yearLevel) || 'Unassigned';
  const email = str(formData?.email).toLowerCase() || null;
  if (!studentId || studentId.length > 100 || !fullName || fullName.length > 200) throw new Error('Valid student ID and name are required.');
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Invalid email address.');
  const enrolled = formData.enrollmentStatus || 'Enrolled';
  if (!['Enrolled', 'Inactive'].includes(enrolled)) throw new Error('Invalid enrollment status.');
  await prisma.$transaction(async tx => {
    const duplicate = await tx.student.findFirst({ where: { organizationId: orgId, studentId: { equals: studentId, mode: 'insensitive' } } });
    let internalId: string;
    if (formData.isEdit) {
      const old = await tx.student.findFirst({ where: { id: str(formData.id), organizationId: orgId } });
      if (!old) throw new Error('Student does not belong to this organization.');
      if (duplicate && duplicate.id !== old.id) throw new Error('Student ID is already registered.');
      const previousEmail = str(old.email).toLowerCase() || null;
      const emailChanged = previousEmail !== email;
      if (emailChanged) {
        if (!formData.emailChangeIdentityVerified) {
          throw new Error('Before changing a registered email, verify the student identity under school policy and confirm that review.');
        }
        // Fail closed: blanking the OTP destination is not routine roster editing.
        if (!email) throw new Error('Do not clear a registered email through roster editing. Contact the tenant administrator for identity recovery.');
        const emailOwner = await tx.student.findFirst({
          where: { organizationId: orgId, id: { not: old.id }, email: { equals: email, mode: 'insensitive' } },
          select: { id: true },
        });
        if (emailOwner) throw new Error('Email address is already assigned to another student in this organization.');
      }
      if (studentId !== old.studentId) {
        const [payments, penalties, remittances] = await Promise.all([
          tx.collection.count({ where: { organizationId: orgId, studentId: old.id } }),
          tx.penalty.count({ where: { organizationId: orgId, studentId: old.studentId } }),
          tx.onlineRemittance.count({ where: { organizationId: orgId, studentId: old.studentId } }),
        ]);
        const due = await tx.collectible.findFirst({ where: { organizationId: orgId, status: { contains: `SID:${encodeURIComponent(old.studentId)}` } }, select: { id: true } });
        if (payments + penalties + remittances > 0 || due) throw new Error('Student ID cannot be changed when payment, penalty, remittance, or collectible history exists.');
      }
      await tx.student.update({ where: { id: old.id }, data: { studentId, fullName, yearLevel, email } });
      if (emailChanged) {
        // No addresses, OTPs or bearer tokens in the audit log.
        await tx.systemLog.create({
          data: {
            organizationId: orgId, user: officer, action: 'STUDENT_EMAIL_IDENTITY_REVIEW',
            details: 'Student record ' + old.id + ': officer attested school-policy identity check; ' +
              (previousEmail ? 'address changed' : 'initial address entered') + '; student OTP still required',
          },
        });
      }
      internalId = old.id;
    } else {
      if (duplicate) throw new Error('Student ID is already registered.');
      if (email && await tx.student.findFirst({
        where: { organizationId: orgId, email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      })) throw new Error('Email address is already assigned to another student in this organization.');
      const student = await tx.student.create({ data: { organizationId: orgId, studentId, fullName, yearLevel, email } });
      internalId = student.id;
    }
    await enrollmentStatus(tx, internalId, orgId, academicYear, academicTerm, enrolled, officer);
    await tx.systemLog.create({ data: { organizationId: orgId, user: officer, action: formData.isEdit ? 'UPDATE_STUDENT' : 'CREATE_STUDENT', details: `${studentId} — ${fullName}` } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
  refresh(dept);
  return { success: true };
}

export async function deleteStudent(department: string, studentInternalId: string) {
  const { dept, orgId, officer } = await scope(department);
  // Expected accounting restrictions are returned as normal results.
  // In production, throwing from a Server Action obscures the original
  // message with a generic React error/digest on the client.
  const result = await prisma.$transaction(async tx => {
    const student = await tx.student.findFirst({ where: { id: str(studentInternalId), organizationId: orgId } });
    if (!student) {
      return { success: false as const, code: 'NOT_FOUND' as const,
        message: 'Student not found in this organization. Refresh the roster and try again.' };
    }
    const [collections, penalties, remittances, enrollments] = await Promise.all([
      tx.collection.count({ where: { organizationId: orgId, studentId: student.id } }),
      tx.penalty.count({ where: { organizationId: orgId, studentId: student.studentId } }),
      tx.onlineRemittance.count({ where: { organizationId: orgId, studentId: student.studentId } }),
      tx.enrollment.count({ where: { organizationId: orgId, studentId: student.id } }),
    ]);
    const due = await tx.collectible.findFirst({
      where: { organizationId: orgId, status: { contains: `SID:${encodeURIComponent(student.studentId)}` } },
      select: { id: true },
    });
    if (collections + penalties + remittances > 0 || due) {
      return { success: false as const, code: 'FINANCIAL_HISTORY' as const,
        message: 'This student has financial records and cannot be permanently deleted. Use Set Inactive in the roster to preserve the audit trail.' };
    }
    await tx.enrollment.deleteMany({ where: { organizationId: orgId, studentId: student.id } });
    const removed = await tx.student.deleteMany({ where: { id: student.id, organizationId: orgId } });
    if (removed.count !== 1) throw new Error('Student deletion failed.');
    await tx.systemLog.create({ data: {
      organizationId: orgId, user: officer, action: 'DELETE_STUDENT',
      details: `${student.studentId}: ${student.fullName}, ${enrollments} enrollments removed`,
    } });
    return { success: true as const };
  });
  if (result.success) refresh(dept);
  return result;
}

export async function bulkImportStudents(department: string, _clientOrgId: string, ay: string, term: string, records: Array<{ studentId: string; fullName: string; yearLevel: string; email?: string }>) {
  const { dept, orgId, officer } = await scope(department);
  const academicYear = validTerm(ay, 'Academic year');
  const academicTerm = validTerm(term, 'Term');
  if (!Array.isArray(records) || records.length === 0 || records.length > 500) throw new Error('Import must contain 1–500 student records. Split larger files into batches.');
  const unique = new Set<string>();
  const cleanRecords = records.map(row => {
    const studentId = str(row?.studentId), fullName = str(row?.fullName);
    const email = str(row?.email).toLowerCase() || null;
    if (!studentId || !fullName || studentId.length > 100 || fullName.length > 200) throw new Error('All imported rows need a student ID and full name.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Invalid email: ${email}`);
    if (unique.has(studentId.toLowerCase())) throw new Error(`Student ID appears more than once in import: ${studentId}`);
    unique.add(studentId.toLowerCase());
    return { studentId, fullName, yearLevel: str(row.yearLevel) || '1st Year', email };
  });
  const { added, updated, preservedEmails } = await prisma.$transaction(async tx => {
    let added = 0, updated = 0, preservedEmails = 0;
    for (const row of cleanRecords) {
      const existing = await tx.student.findFirst({ where: { organizationId: orgId, studentId: { equals: row.studentId, mode: 'insensitive' } } });
      let id: string;
      if (existing) {
        // A CSV import must not overwrite/erase an existing OTP destination.
        if ((str(existing.email).toLowerCase() || null) !== row.email) preservedEmails++;
        await tx.student.update({ where: { id: existing.id }, data: { fullName: row.fullName, yearLevel: row.yearLevel } });
        id = existing.id; updated++;
      } else {
        if (row.email && await tx.student.findFirst({
          where: { organizationId: orgId, email: { equals: row.email, mode: 'insensitive' } },
          select: { id: true },
        })) throw new Error('An imported email is already assigned to a student in this organization. Review the CSV.');
        const created = await tx.student.create({ data: { organizationId: orgId, ...row } });
        id = created.id; added++;
      }
      await enrollmentStatus(tx, id, orgId, academicYear, academicTerm, 'Enrolled', officer);
    }
    await tx.systemLog.create({ data: { organizationId: orgId, user: officer, action: 'BULK_IMPORT_STUDENTS', details: `${added} added, ${updated} updated (${academicYear} ${academicTerm})` } });
    return { added, updated, preservedEmails };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000 });
  refresh(dept);
  return {
    success: true,
    message: `Successfully imported: ${added} added, ${updated} updated. Existing emails preserved for ${preservedEmails} CSV mismatch(es); review individually after verifying identity.`,
    added, updated, preservedEmails,
  };
}
