/* Preview by default; --apply updates schema.prisma after creating a timestamped backup.
 * Never runs migrations or modifies a database. */
const fs = require("node:fs");
const path = require("node:path");
const schemaPath = path.join(process.cwd(),"prisma","schema.prisma");
const original = fs.readFileSync(schemaPath,"utf8");
let src=original;
function addRelation(model, field) {
  const found = new RegExp(`model\\s+${model}\\s*\\{`).exec(src);
  if (!found) throw new Error(`Missing Prisma model ${model}`);
  const start = found.index; const end = src.indexOf("\n}",start);
  if(end<0) throw new Error(`Missing closing brace for ${model}`);
  const body = src.slice(start,end);
  if (!body.includes("transactionEmailPreferences")) src=src.slice(0,end)+"\n  "+field+src.slice(end);
}
addRelation("Organization", "transactionEmailPreferences TransactionEmailPreference[]");
if (!/model\s+TransactionEmailPreference\s*\{/.test(src)) {
 src+=`
model TransactionEmailPreference {
  id                       String        @id @default(cuid())
  organizationId           String
  email                    String
  receiveParticipantEmails Boolean       @default(true)
  receiveOfficerCopies     Boolean       @default(true)
  createdAt                DateTime      @default(now())
  updatedAt                DateTime      @updatedAt
  organization             Organization  @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  @@unique([organizationId, email], map: "TEP_org_email_unique")
  @@index([organizationId], map: "TEP_org_idx")
}
`;
}
if(src===original){console.log("Schema already updated; no changes required.");process.exit(0)}
if(process.argv.includes("--apply")){
 const backup=schemaPath+`.backup-${new Date().toISOString().replace(/[:.]/g,"-")}`;
 fs.copyFileSync(schemaPath,backup);fs.writeFileSync(schemaPath,src);
 console.log("Updated schema.prisma. Backup:",backup);
}else console.log("PREVIEW: add TransactionEmailPreference model + Organization reverse relation. Run with --apply to write changes.");
