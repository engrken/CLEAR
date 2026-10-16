// /app/department/[department]/(protected)/students/actions.ts

'use server';

import { prisma } from '@/lib/prisma';
import { requireDepartmentAccess } from '@/lib/permissions';
import { logSystemAction } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

export async function toggleStudentStatus(department: string, studentId: string, currentStatus: string, ay: string, term: string) {
  const { user, org } = await requireDepartmentAccess('tab-students', department);
  const cleanDept = org.subdomain;
  const organizationId = org.id;
  const officerName = user.name || user.fullName || user.email || "System Administrator";

  const newStatus = currentStatus === 'Enrolled' ? 'Inactive' : 'Enrolled';
  const student = await prisma.student.findFirst({ where: { id: studentId, organizationId } });
  if (!student) return { success: false, message: "Student not found" };

  const existingEnrollment = await prisma.enrollment.findFirst({
    where: { studentId: student.id, academicYear: ay, term },
  });

  if (existingEnrollment) {
    await prisma.enrollment.update({
      where: { id: existingEnrollment.id },
      data: { enrollmentStatus: newStatus },
    });
  } else {
    await prisma.enrollment.create({
      data: {
        studentId: student.id,
        organizationId: student.organizationId,
        academicYear: ay,
        term,
        enrollmentStatus: newStatus,
      },
    });
  }

  await logSystemAction(
    student.organizationId,
    officerName,
    "TOGGLE_STUDENT_STATUS",
    `Changed enrollment status for student ${student.fullName} to ${newStatus} for ${ay} (${term}).`
  );

  revalidatePath(`/department/${cleanDept}/students`);
  return { success: true };
}

export async function confirmAllEnrolled(department: string, _clientOrganizationId: string, ay: string, term: string) {
  const { user, org } = await requireDepartmentAccess('tab-students', department);
  const cleanDept = org.subdomain;
  const organizationId = org.id;
  const officerName = user.name || user.fullName || user.email || "System Administrator";

  const allStudents = await prisma.student.findMany({ where: { organizationId } });
  for (const student of allStudents) {
    const existing = await prisma.enrollment.findFirst({
      where: { studentId: student.id, academicYear: ay, term },
    });
    if (existing) {
      await prisma.enrollment.update({ where: { id: existing.id }, data: { enrollmentStatus: 'Enrolled' } });
    } else {
      await prisma.enrollment.create({
        data: { studentId: student.id, organizationId, academicYear: ay, term, enrollmentStatus: 'Enrolled' },
      });
    }
  }

  await logSystemAction(
    organizationId,
    officerName,
    "CONFIRM_ALL_ENROLLED",
    `Confirmed all ${allStudents.length} students as Enrolled for ${ay} (${term}).`
  );

  revalidatePath(`/department/${cleanDept}/students`);
  return { success: true, count: allStudents.length };
}

export async function promoteYearLevels(department: string, _clientOrganizationId: string) {
  const { user, org } = await requireDepartmentAccess('tab-students', department);
  const cleanDept = org.subdomain;
  const organizationId = org.id;
  const officerName = user.name || user.fullName || user.email || "System Administrator";

  const students = await prisma.student.findMany({ where: { organizationId } });
  let promoted = 0;
  for (const s of students) {
    let nextYear = s.yearLevel;
    if (s.yearLevel === '1st Year') nextYear = '2nd Year';
    else if (s.yearLevel === '2nd Year') nextYear = '3rd Year';
    else if (s.yearLevel === '3rd Year') nextYear = '4th Year';
    else if (s.yearLevel === '4th Year') nextYear = 'Graduated / Alumni';

    if (nextYear !== s.yearLevel) {
      await prisma.student.update({ where: { id: s.id }, data: { yearLevel: nextYear } });
      promoted++;
    }
  }

  await logSystemAction(
    organizationId,
    officerName,
    "PROMOTE_YEAR_LEVELS",
    `Promoted year levels for ${promoted} student(s).`
  );

  revalidatePath(`/department/${cleanDept}/students`);
  return { success: true, promoted };
}

export async function saveStudent(department: string, _clientOrganizationId: string, ay: string, term: string, formData: {
  id?: string;
  studentId: string;
  fullName: string;
  yearLevel: string;
  email?: string;
  enrollmentStatus?: string;
  isEdit: boolean;
  originalId?: string;
}) {
  const { user, org } = await requireDepartmentAccess('tab-students', department);
  const cleanDept = org.subdomain;
  const organizationId = org.id;
  const officerName = user.name || user.fullName || user.email || "System Administrator";

  if (!formData.studentId || !formData.fullName) {
    throw new Error("Student ID and Full Name are required.");
  }

  let studentRecordId: string;

  if (formData.isEdit && formData.id) {
    const owned = await prisma.student.findFirst({ where: { id: formData.id, organizationId }, select: { id: true } });
    if (!owned) throw new Error("Student record not found in this department.");
    const updated = await prisma.student.update({
      where: { id: owned.id },
      data: {
        studentId: formData.studentId,
        fullName: formData.fullName,
        yearLevel: formData.yearLevel,
        email: formData.email || null,
      },
    });
    studentRecordId = updated.id;

    if (formData.enrollmentStatus) {
      const existingEnrollment = await prisma.enrollment.findFirst({
        where: { studentId: studentRecordId, academicYear: ay, term },
      });
      if (existingEnrollment) {
        await prisma.enrollment.update({
          where: { id: existingEnrollment.id },
          data: { enrollmentStatus: formData.enrollmentStatus },
        });
      } else {
        await prisma.enrollment.create({
          data: { studentId: studentRecordId, organizationId, academicYear: ay, term, enrollmentStatus: formData.enrollmentStatus },
        });
      }
    }
  } else {
    const newStudent = await prisma.student.create({
      data: {
        studentId: formData.studentId,
        fullName: formData.fullName,
        yearLevel: formData.yearLevel,
        email: formData.email || null,
        organizationId,
      },
    });
    studentRecordId = newStudent.id;

    await prisma.enrollment.create({
      data: {
        studentId: newStudent.id,
        organizationId,
        academicYear: ay,
        term,
        enrollmentStatus: formData.enrollmentStatus || 'Enrolled',
      },
    });
  }

  await logSystemAction(
    organizationId,
    officerName,
    formData.isEdit ? "UPDATE_STUDENT" : "CREATE_STUDENT",
    `${formData.isEdit ? "Updated" : "Created"} student record for ${formData.fullName} (${formData.studentId}).`
  );

  revalidatePath(`/department/${cleanDept}/students`);
  return { success: true };
}

export async function deleteStudent(department: string, studentInternalId: string) {
  const { user, org } = await requireDepartmentAccess('tab-students', department);
  const cleanDept = org.subdomain;
  const officerName = user.name || user.fullName || user.email || "System Administrator";

  const student = await prisma.student.findFirst({
    where: { id: studentInternalId, organizationId: org.id },
  });

  if (!student) throw new Error('Student record not found.');

  // Perform atomic transaction cleanup maintaining relational integrity
  await prisma.$transaction(async (tx) => {
    await tx.enrollment.deleteMany({ where: { studentId: studentInternalId, organizationId: org.id } });
    // Disconnect or set null on collections if necessary, or delete
    await tx.collection.updateMany({
      where: { studentId: studentInternalId, organizationId: org.id },
      data: { studentId: null }
    });
    await tx.student.delete({ where: { id: studentInternalId } });
  });

  await logSystemAction(
    org.id,
    officerName,
    "DELETE_STUDENT",
    `Deleted student record for ${student.fullName} (${student.studentId}).`
  );

  revalidatePath(`/department/${cleanDept}/students`);
  return { success: true };
}

export async function bulkImportStudents(department: string, _clientOrganizationId: string, ay: string, term: string, records: Array<{ studentId: string; fullName: string; yearLevel: string; email?: string }>) {
  const { user, org } = await requireDepartmentAccess('tab-students', department);
  const cleanDept = org.subdomain;
  const organizationId = org.id;
  const officerName = user.name || user.fullName || user.email || "System Administrator";

  let added = 0;
  let updated = 0;

  for (const r of records) {
    if (!r.studentId || !r.fullName) continue;

    const existing = await prisma.student.findFirst({
      where: { organizationId, studentId: { equals: r.studentId, mode: 'insensitive' } },
    });

    let studentRecordId: string;

    if (existing) {
      await prisma.student.update({
        where: { id: existing.id },
        data: { fullName: r.fullName, yearLevel: r.yearLevel || existing.yearLevel, email: r.email || existing.email },
      });
      studentRecordId = existing.id;
      updated++;
    } else {
      const created = await prisma.student.create({
        data: {
          studentId: r.studentId,
          fullName: r.fullName,
          yearLevel: r.yearLevel || '1st Year',
          email: r.email || null,
          organizationId,
        },
      });
      studentRecordId = created.id;
      added++;
    }

    const enrollExists = await prisma.enrollment.findFirst({
      where: { studentId: studentRecordId, academicYear: ay, term },
    });

    if (enrollExists) {
      await prisma.enrollment.update({
        where: { id: enrollExists.id },
        data: { enrollmentStatus: 'Enrolled' },
      });
    } else {
      await prisma.enrollment.create({
        data: { studentId: studentRecordId, organizationId, academicYear: ay, term, enrollmentStatus: 'Enrolled' },
      });
    }
  }

  await logSystemAction(
    organizationId,
    officerName,
    "BULK_IMPORT_STUDENTS",
    `Imported student roster: ${added} added, ${updated} updated for ${ay} (${term}).`
  );

  revalidatePath(`/department/${cleanDept}/students`);
  return { success: true, message: `Successfully imported: ${added} added, ${updated} updated.` };
}