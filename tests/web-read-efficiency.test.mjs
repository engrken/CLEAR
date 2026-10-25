import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('default student roster avoids a redundant count without changing tenant, period or status filters', () => {
  const src = read('app/department/[department]/(protected)/students/page.tsx');
  assert.match(src, /await requireTabAccess\('tab-students', cleanDepartment\)/);
  assert.match(src, /const unfilteredRoster = !missingEmailOnly && !search\.trim\(\) && yearFilter === 'ALL' && statusFilter === 'ALL'/);
  assert.match(src, /unfilteredRoster \? Promise\.resolve\(null\) : prisma\.student\.count\(\{ where: whereClause \}\)/);
  assert.match(src, /const totalFiltered = filteredCount \?\? totalDirectory/);
  assert.match(src, /prisma\.student\.findMany\(\{\s*where: whereClause/);
  assert.match(src, /select: \{\s*id: true, studentId: true, fullName: true, yearLevel: true, email: true/);
  assert.match(src, /where: \{ academicYear: ay, term \},\s*select: \{ enrollmentStatus: true \}/);
  assert.match(src, /skip: \(page - 1\) \* pageSize,\s*take: pageSize/);
});

test('public clearance guide stops polling after privacy notice is accepted', () => {
  const src = read('app/department/[department]/clearance/StudentClearanceGuide.tsx');
  assert.match(src, /window\.localStorage\.getItem\('clear_privacy_accepted'\) === 'true'/);
  assert.match(src, /if \(!check\(\)\) \{/);
  assert.match(src, /if \(check\(\) && timer !== null\)/);
  assert.match(src, /window\.clearInterval\(timer\)/);
  assert.match(src, /window\.localStorage\.setItem\(storageKey, 'true'\)/);
  assert.doesNotMatch(src, /Authorization:|studentName|registeredEmail|outstandingCentavos/);
});

test('Void Center collections search uses bounded tenant SQL relation rather than an unbounded roster scan', () => {
  const page = read('app/department/[department]/(protected)/void/page.tsx');
  assert.match(page, /requireTabAccess\('tab-void', slug\)/);
  assert.match(page, /if \(q && category !== 'collections'\)/);
  assert.match(page, /student: \{ is: \{/);
  assert.match(page, /organizationId: organization\.id/);
  assert.match(page, /select: \{ studentId: true \}/);
  assert.match(page, /include: \{ student: \{ select: \{ fullName: true \} \} \}/);
  assert.doesNotMatch(page, /matchedDbIds|include: \{ student: true \}/);
  assert.match(page, /prisma\.collection\.count\(\{ where \}\)/);
  assert.match(page, /skip, take: pageSize/);
});
