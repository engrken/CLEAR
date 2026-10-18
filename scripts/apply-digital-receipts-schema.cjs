/* Idempotent source-schema patch. PREVIEW by default; --apply writes schema.prisma */
const fs = require('node:fs');
const path = require('node:path');
const schemaPath = path.resolve(process.cwd(), 'prisma/schema.prisma');
let src = fs.readFileSync(schemaPath, 'utf8');
function addRelation(model, line, signature) {
  const m = new RegExp('model\\s+' + model + '\\s*\\{');
  const x = m.exec(src); if (!x) throw new Error('Missing ' + model + ' model');
  const end = src.indexOf('\n}', x.index); if (end < 0) throw new Error('Missing ' + model + ' closing brace');
  const frag = src.slice(x.index, end);
  if (!frag.includes(signature)) src = src.slice(0,end) + '\n  ' + line + src.slice(end);
}
addRelation('Organization', 'digitalReceiptDeliveries DigitalReceiptDelivery[]', 'digitalReceiptDeliveries');
const model = `
model DigitalReceiptDelivery {
  id             String       @id @default(cuid())
  organizationId String
  eventKey       String
  documentType   String
  referenceNo    String
  recipientEmail String
  recipientRole  String
  subject        String
  html           String       @db.Text
  status         String       @default("Pending")
  attempts       Int          @default(0)
  nextAttemptAt  DateTime     @default(now())
  lastError      String?
  sentAt         DateTime?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@unique([organizationId, eventKey, recipientEmail], map: "DRD_unique_delivery")
  @@index([status, nextAttemptAt], map: "DRD_retry_queue_idx")
  @@index([organizationId, createdAt], map: "DRD_org_created_idx")
}
`;
if (!/model\s+DigitalReceiptDelivery\s*\{/.test(src)) src += '\n' + model;
const prev = fs.readFileSync(schemaPath,'utf8');
if (src === prev) { console.log('No changes: schema already contains digital receipt model and relation.'); process.exit(0); }
if (!process.argv.includes('--apply')) { console.log('Preview only: would add DigitalReceiptDelivery and Organization relation; run --apply to write.'); process.exit(0); }
const backup = schemaPath + '.pre-digital-receipts.bak';
fs.copyFileSync(schemaPath,backup); fs.writeFileSync(schemaPath,src);
console.log('Updated schema.prisma; backup:',backup);
