import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  baseOfficialReceiptNumber,
  buildIssuedReceipts,
  filterIssuedReceipts,
} from "../app/department/[department]/(protected)/collections/history/receipt-grouping.ts";

const date = "2026-09-03T00:00:00.000Z";
const row = (extra = {}) => ({
  id: crypto.randomUUID(),
  orNumber: "26-376",
  studentId: "student-avel-uuid",
  studentName: "PACARDO, AVEL",
  student: { studentId: "25-CECE1-0017" },
  academicYear: "A.Y. 2026 - 2027",
  term: "1st Sem",
  date,
  timestamp: date,
  encodedBy: "Officer",
  category: "Departmental Fee",
  itemDescription: "Membership Fee",
  paymentType: "Full Payment",
  status: "Valid",
  amountPaid: 250,
  ...extra,
});
const pacardo = [
  row(),
  row({ id: "b", itemDescription: "General Orientation", amountPaid: 200 }),
  row({ id: "c", itemDescription: "COE FCUSR Activities", amountPaid: 100 }),
  row({ id: "d", itemDescription: "Sports and Cultural Fund", amountPaid: 100 }),
];

test("OR 26-376: one valid historical package receipt for four allocations totaling PHP 650", () => {
  const list = buildIssuedReceipts(pacardo);
  assert.equal(list.length, 1);
  assert.equal(list[0].orNumber, "26-376");
  assert.equal(list[0].count, 4);
  assert.equal(list[0].total, 650);
  assert.equal(list[0].status, "Valid");
  assert.equal(list[0].inconsistencyReason, "");
});
test("new -P02/-P03 package allocations belong to the base OR", () => {
  assert.equal(baseOfficialReceiptNumber("26-999-P02"), "26-999");
  const list = buildIssuedReceipts([
    row({ orNumber: "26-999" }),
    row({ orNumber: "26-999-P02", itemDescription: "Second", amountPaid: 200 }),
    row({ orNumber: "26-999-P03", itemDescription: "Third", amountPaid: 50 }),
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].total, 500);
  assert.equal(list[0].status, "Valid");
});
test("mixed voided allocations, absent base and student collisions are not silently called Valid", () => {
  assert.equal(buildIssuedReceipts([row(),row({itemDescription:"Two",status:"Voided"})])[0].status, "Inconsistent");
  assert.match(buildIssuedReceipts([row({orNumber:"26-999-P02"})])[0].inconsistencyReason, /No base/);
  assert.match(buildIssuedReceipts([
    row(),row({itemDescription:"Other",studentId:"another-student",studentName:"OTHER STUDENT"}),
  ])[0].inconsistencyReason, /Conflicting students/);
});
test("the same OR in different periods is not merged into a single payment", () => {
  const list = buildIssuedReceipts([
    row(),row({academicYear:"A.Y. 2027 - 2028",itemDescription:"Membership Fee"}),
  ]);
  assert.equal(list.length, 2);
  assert.ok(list.every(x => x.status === "Inconsistent"));
  assert.ok(list.every(x => /reused across academic periods/.test(x.inconsistencyReason)));
});
test("exact OR, status, category, payment type, date and description filters run on grouped receipts", () => {
  const list = buildIssuedReceipts([...pacardo,
    row({orNumber:"26-556",studentId:"another",studentName:"DE LEON, EUNICE",
      student:{studentId:"26-COE1-F0035"},date:"2026-09-06T00:00:00.000Z",
      itemDescription:"Penalty Fine",category:"Others",amountPaid:50 }),
  ]);
  const opts = { q:"",exactOr:"",status:"all",category:"",description:"",
    paymentType:"",from:"",to:"",inconsistentOnly:false };
  assert.equal(filterIssuedReceipts(list,{...opts,exactOr:"26-556"}).length,1);
  assert.equal(filterIssuedReceipts(list,{...opts,exactOr:"26-558"}).length,0);
  assert.equal(filterIssuedReceipts(list,{...opts,q:"PACARDO"}).length,1);
  assert.equal(filterIssuedReceipts(list,{...opts,category:"Departmental Fee"}).length,1);
  assert.equal(filterIssuedReceipts(list,{...opts,description:"FCUSR"}).length,1);
  assert.equal(filterIssuedReceipts(list,{...opts,description:"Penalty"}).length,1);
  assert.equal(filterIssuedReceipts(list,{...opts,paymentType:"Full Payment"}).length,2);
  assert.equal(filterIssuedReceipts(list,{...opts,from:"2026-09-06"}).length,1);
  assert.equal(filterIssuedReceipts(list,{...opts,to:"2026-09-05"}).length,1);
  assert.equal(filterIssuedReceipts(list,{...opts,status:"inconsistent"}).length,0);
});
test("receipt history page counts grouped receipts before pagination and makes no financial writes", () => {
  const page = readFileSync(new URL("../app/department/[department]/(protected)/collections/history/page.tsx",import.meta.url),"utf8");
  const client = readFileSync(new URL("../app/department/[department]/(protected)/collections/history/ReceiptHistoryClient.tsx",import.meta.url),"utf8");
  assert.match(page,/const grouped = buildIssuedReceipts\(allocationLines(?:\.map\(row => \(\{ \.\.\.row, amountPaid: moneyNumber\(row\.amountPaid\) \}\)\))?\)/);
  assert.match(page,/const matched = filterIssuedReceipts\(grouped/);
  assert.match(page,/const total = matched.length/);
  assert.match(page,/const receipts = matched.slice\(/);
  assert.doesNotMatch(page,/prisma\.\w+\.(create|update|upsert|delete|createMany|deleteMany|updateMany)\(/);
  assert.match(client,/!isNavigating && <div className="table-responsive">/);
  assert.match(client,/Only inconsistent receipts/);
  assert.match(client,/Exact OR number/);
});

test("read-only history keeps anomalous legacy amounts reviewable without inventing money", () => {
  const original = row({ id: "sub-cent", orNumber: "26-998", amountPaid: 1.005 });
  const abnormal = buildIssuedReceipts([original]);
  assert.equal(abnormal.length, 1);
  assert.equal(abnormal[0].status, "Inconsistent");
  assert.equal(abnormal[0].total, null, "never round a suspicious receipt into a monetary total");
  assert.match(abnormal[0].inconsistencyReason, /Sub-cent or unsafe monetary precision/);
  assert.equal(original.amountPaid, 1.005, "never mutate historical source data");

  const invalid = buildIssuedReceipts([row({ id: "nan", orNumber: "26-997", amountPaid: NaN })]);
  assert.equal(invalid[0].status, "Inconsistent");
  assert.equal(invalid[0].total, null);
  assert.match(invalid[0].inconsistencyReason, /Non-finite monetary amount/);

  const page = readFileSync(new URL("../app/department/[department]/(protected)/collections/history/page.tsx",import.meta.url),"utf8");
  const client = readFileSync(new URL("../app/department/[department]/(protected)/collections/history/ReceiptHistoryClient.tsx",import.meta.url),"utf8");
  assert.match(page, /buildIssuedReceipts\(allocationLines\)/);
  assert.doesNotMatch(page, /moneyNumber\(row\.amountPaid\)/);
  assert.match(client, /Requires reconciliation/);
});
