#!/usr/bin/env node
/** Applies ONLY the AcademicPeriodConfig Prisma model to your existing schema. */
const fs = require('node:fs');
const path = require('node:path');
const file = path.resolve(process.cwd(), 'prisma/schema.prisma');
if (!fs.existsSync(file)) { console.error(`Missing ${file}`); process.exit(1); }
const original = fs.readFileSync(file, 'utf8');
const relation = '  academicPeriodConfigs AcademicPeriodConfig[]';
const model = `
// Tenant-specific accounting calendar per academic year.
model AcademicPeriodConfig {
  id             String       @id @default(cuid())
  organizationId String
  academicYear   String
  mode           String       @default("Semester")
  includeSummer  Boolean      @default(true)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, academicYear])
  @@index([organizationId])
}
`;
const alreadyModel = /\bmodel\s+AcademicPeriodConfig\s*\{/.test(original);
const alreadyRelation = original.includes('academicPeriodConfigs AcademicPeriodConfig[]');
if (alreadyModel !== alreadyRelation) { console.error('Partial AcademicPeriodConfig schema modification detected. Review manually.'); process.exit(1); }
if (alreadyModel && alreadyRelation) { console.log('Already applied; schema unchanged.'); process.exit(0); }
const organizationOpen = original.indexOf('model Organization {');
const organizationEnd = original.indexOf('\n}', organizationOpen);
if (organizationOpen < 0 || organizationEnd < 0) { console.error('Organization model not found.'); process.exit(1); }
const modified = original.slice(0, organizationEnd) + '\n' + relation + original.slice(organizationEnd) + model;
console.log('Will add Organization.academicPeriodConfigs and AcademicPeriodConfig model to',file);
if (!process.argv.includes('--apply')) { console.log('DRY RUN. Re-run with --apply after database backup.'); process.exit(0); }
const backup = `${file}.before-calendar-${Date.now()}.bak`;
fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
fs.writeFileSync(file, modified);
console.log('Saved:', file);
console.log('Original schema backup:', backup);
console.log('NEXT: npx prisma format && npx prisma migrate dev --name academic_period_config && npx prisma generate');
