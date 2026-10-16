// /lib/financials.ts
//
// The department financial engine: collections, expenses, advances, receivables,
// fund balances and cashier safekeeping for one organization and term. Pure data
// access with no authorization: callers must check access first (the web
// server action getDepartmentFinancials, the mobile API guard).

import { prisma } from '@/lib/prisma';
import { money as roundMoney } from '@/lib/utils';

export function isVoidedRecord(row: { paymentType?: unknown; status?: unknown }) {
  const pt = String(row.paymentType || '').toUpperCase();
  const st = String(row.status || '').toUpperCase();
  return pt.includes('VOID') || st.includes('VOID') || st.includes('CANCEL');
}

export function getStudentKey(dbId?: unknown, name?: unknown, fallback = '') {
  const id = String(dbId || '').trim().toLowerCase();
  const n = String(name || '').trim().toLowerCase();
  return id ? `ID:${id}` : n ? `NAME:${n}` : fallback;
}

export function normalizeItemKey(val: unknown) {
  return String(val || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function computeDepartmentFinancials(organizationId: string, ay: string, term: string) {

  const [
    collections,
    audits,
    cashAdvances,
    explicitCollectibles,
    initialFunds,
    students,
    enrollments,
    collectionSetups,
    fundTransfers,
    cashierRecords,
  ] = await Promise.all([
    prisma.collection.findMany({
      where: { organizationId, academicYear: ay, term },
      include: { student: { select: { id: true, studentId: true, fullName: true } } },
    }),
    prisma.audit.findMany({ where: { organizationId, academicYear: ay, term } }),
    prisma.cashAdvance.findMany({
      where: { organizationId, academicYear: ay, term },
      orderBy: { dateIssued: 'desc' },
    }),
    prisma.collectible.findMany({ where: { organizationId, academicYear: ay, term } }),
    prisma.fund.findMany({ where: { organizationId, academicYear: ay, term } }),
    prisma.student.findMany({ where: { organizationId } }),
    prisma.enrollment.findMany({
      where: { organizationId, academicYear: ay, term },
      include: { student: { select: { id: true, studentId: true, fullName: true } } },
    }),
    prisma.collectionSetup.findMany({ where: { organizationId, academicYear: ay, term } }),
    prisma.fundTransfer.findMany({ where: { organizationId, academicYear: ay, term } }),
    prisma.cashierRemittance.findMany({
      where: { organizationId, academicYear: ay, term, status: 'Remitted' },
    }),
  ]);

  // 1. SAFEKEEPING MATH
  const totalDeposited = roundMoney(
    cashierRecords
      .filter((r) => r.type === 'Deposit')
      .reduce((s, r) => s + (Number(r.amount) || 0), 0)
  );
  const totalWithdrawn = roundMoney(
    cashierRecords
      .filter((r) => r.type === 'Withdrawal')
      .reduce((s, r) => s + (Number(r.amount) || 0), 0)
  );
  const cashierBalance = roundMoney(totalDeposited - totalWithdrawn);

  // 2. VALIDATION & HELPERS
  const validCollections = collections.filter((c: any) => !isVoidedRecord(c));
  const validAudits = audits.filter(
    (a: any) => !String(a.status || '').toUpperCase().match(/VOID|CANCEL/)
  );
  const getFundName = (row: any) =>
    [row.fundAllocation, row.fundSource, row.fundName, row.fund].find(
      (f) => f && String(f).trim() !== 'undefined' && String(f).trim() !== 'null'
    ) || 'General Fund (Carried Over)';

  // 3. PACKAGES
  const legacyPkgs: any = {
    '1st Sem': {
      total: 650,
      items: [
        { name: 'JIECEP FCUSC Membership Fee (Student & Institutional)', rate: 250, fund: 'JIECEP Membership Fund' },
        { name: 'General Orientation/Acquaintance Party', rate: 200, fund: 'General Orientation Fund' },
        { name: 'COE FCUSR Activities', rate: 100, fund: 'FCUSR Activities Fund' },
        { name: 'Sports and Cultural Fund', rate: 100, fund: 'Sports & Cultural Fund' },
      ],
    },
    '2nd Sem': {
      total: 900,
      items: [
        { name: 'JIECEP FCUSC Fund', rate: 50, fund: 'JIECEP FCUSC Fund' },
        { name: 'JIECEP Week Activities (Local & Regional)', rate: 150, fund: 'JIECEP Week Activities Fund' },
        { name: 'ECE Grand Ball', rate: 650, fund: 'ECE Grandball Fund' },
        { name: 'Emergency/Calamity Fund', rate: 30, fund: 'Emergency/Calamity Fund' },
        { name: 'FCUSR Activities & Projects', rate: 20, fund: 'FCUSR Activities Fund' },
      ],
    },
    Summer: {
      total: 200,
      items: [
        { name: 'Summer Departmental Operations', rate: 150, fund: 'New Accounts (Current Operations)' },
        { name: 'Special Activities Fund', rate: 50, fund: 'JIECEP Activities Fund' },
      ],
    },
  };

  const pkgItems = collectionSetups.filter((c: any) => c.isPackage !== false);
  const termPkg =
    pkgItems.length > 0
      ? {
          total: roundMoney(pkgItems.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0)),
          items: pkgItems.map((s: any) => ({
            name: String(s.name || '').trim(),
            rate: roundMoney(s.amount),
            fund: String(s.targetFund || '').trim(),
          })),
        }
      : legacyPkgs[term] || legacyPkgs['1st Sem'];

  // 4. COLLECTIONS & MATCHING
  let grandCollectionTotal = 0;
  const collectionHierarchy: Record<string, { count: number; total: number }> = {};
  const distinctStudents: Record<string, Set<string>> = {};
  const collectionsByFund: Record<string, number> = {};

  const paidByDbStudentId: Record<string, number> = {};
  const paidByStudentNumber: Record<string, number> = {};
  const paidByUniqueStudentName: Record<string, number> = {};

  const studentsByDbId = new Map(students.map((s: any) => [String(s.id).toLowerCase(), s]));
  const studentsByStudentNumber = new Map(
    students.filter((s: any) => s.studentId).map((s: any) => [String(s.studentId).toLowerCase(), s])
  );
  const studentNameCounts = new Map<string, number>();

  students.forEach((s: any) => {
    const name = String(s.fullName || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (name) studentNameCounts.set(name, (studentNameCounts.get(name) || 0) + 1);
  });

  const addCollectionItem = (name: string, amt: number, key: string, fund: string) => {
    grandCollectionTotal = roundMoney(grandCollectionTotal + amt);
    collectionsByFund[fund] = roundMoney((collectionsByFund[fund] || 0) + amt);
    if (!collectionHierarchy[name]) {
      collectionHierarchy[name] = { count: 0, total: 0 };
      distinctStudents[name] = new Set();
    }
    collectionHierarchy[name].total = roundMoney(collectionHierarchy[name].total + amt);
    if (amt > 0 && key) distinctStudents[name].add(key);
  };

  const obligationGroups = new Map<string, any>();

  validCollections.forEach((c: any) => {
    const desc = String(c.itemDescription || c.category || 'General').trim();
    const descLower = desc.toLowerCase();
    const amt = roundMoney(c.amountPaid);
    const fund = getFundName(c);
    const studentKey = getStudentKey(
      c.studentId || c.student?.id,
      c.student?.fullName || c.studentName,
      String(c.orNumber || '').trim().toLowerCase()
    );

    const matchedPkgItem = termPkg.items.find(
      (pi: any) => String(pi.name).trim().toLowerCase() === descLower
    );
    const isDepPkg = [
      'departmental fee package',
      'departmental fee',
      'departmental fee package (all items)',
    ].includes(descLower);

    if (matchedPkgItem) {
      addCollectionItem(matchedPkgItem.name, amt, studentKey, matchedPkgItem.fund);
    } else if (isDepPkg) {
      const pkgTotalRate = Number(termPkg.total) || 0;
      if (pkgTotalRate > 0) {
        termPkg.items.forEach((pi: any) =>
          addCollectionItem(pi.name, (Number(pi.rate) / pkgTotalRate) * amt, studentKey, pi.fund)
        );
      } else {
        addCollectionItem(desc, amt, studentKey, fund);
      }
    } else {
      addCollectionItem(desc, amt, studentKey, fund);
    }

    if ((matchedPkgItem || isDepPkg) && amt > 0) {
      const relId = String(c.student?.id || '').toLowerCase();
      const rawRef = String(c.studentId || '').toLowerCase();
      const uniqueName = String(c.student?.fullName || c.studentName || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');

      if (relId && studentsByDbId.has(relId)) {
        paidByDbStudentId[relId] = roundMoney((paidByDbStudentId[relId] || 0) + amt);
      } else if (rawRef && studentsByDbId.has(rawRef)) {
        paidByDbStudentId[rawRef] = roundMoney((paidByDbStudentId[rawRef] || 0) + amt);
      } else if (rawRef && studentsByStudentNumber.has(rawRef)) {
        paidByStudentNumber[rawRef] = roundMoney((paidByStudentNumber[rawRef] || 0) + amt);
      } else if (uniqueName && studentNameCounts.get(uniqueName) === 1) {
        paidByUniqueStudentName[uniqueName] = roundMoney(
          (paidByUniqueStudentName[uniqueName] || 0) + amt
        );
      }
    }

    if (!matchedPkgItem && !isDepPkg) {
      const itemName = desc || String(c.category || '').trim() || 'Other Due';
      const groupKey = `${studentKey}|${itemName.trim().toLowerCase()}`;
      const existing = obligationGroups.get(groupKey) || {
        studentKey,
        itemName,
        assessedAmount: 0,
        paidAmount: 0,
        hasOutstandingMarker: false,
      };
      existing.assessedAmount = Math.max(existing.assessedAmount, roundMoney(c.standardRate));
      existing.paidAmount = roundMoney(existing.paidAmount + amt);
      existing.hasOutstandingMarker =
        existing.hasOutstandingMarker ||
        Number(c.balanceDue) > 0 ||
        String(c.paymentType).toLowerCase().includes('unpaid') ||
        String(c.orNumber).toUpperCase().startsWith('DUE-');
      obligationGroups.set(groupKey, existing);
    }
  });

  Object.keys(collectionHierarchy).forEach(
    (key) => (collectionHierarchy[key].count = distinctStudents[key]?.size || 0)
  );

  // 5. EXPENSES & ADVANCES
  const expensesByFund: Record<string, number> = {};
  const grandExpenseTotal = roundMoney(
    validAudits.reduce((sum, a: any) => {
      const amt = roundMoney(a.totalExpense);
      const fund = getFundName(a);
      expensesByFund[fund] = roundMoney((expensesByFund[fund] || 0) + amt);
      return sum + amt;
    }, 0)
  );

  let totalUnliquidated = 0;
  const unliquidatedByFund: Record<string, number> = {};
  const unliquidatedAdvances = cashAdvances
    .filter((ca: any) => {
      const status = String(ca.status || '').toUpperCase();
      return (
        (status.includes('PENDING') || status.includes('UNLIQUIDATED') || status === 'ACTIVE') &&
        !status.includes('CANCEL') &&
        !status.includes('LIQUIDATED')
      );
    })
    .map((ca: any) => {
      const amt = roundMoney(ca.amountApproved);
      const fund = getFundName(ca);
      totalUnliquidated = roundMoney(totalUnliquidated + amt);
      unliquidatedByFund[fund] = roundMoney((unliquidatedByFund[fund] || 0) + amt);
      return {
        id: ca.advanceId,
        advanceId: ca.advanceId,
        date: ca.dateIssued ? new Date(ca.dateIssued).toISOString().split('T')[0] : '',
        requestor: ca.requestor,
        fund,
        amount: amt,
        amountApproved: amt,
        due: ca.expectedReturnDate
          ? new Date(ca.expectedReturnDate).toISOString().split('T')[0]
          : '',
        status: ca.status,
      };
    });

  // 6. COLLECTIBLES
  const collectiblesMap: Record<string, { category: string; headcount: number; total: number }> = {};
  let totalPackageReceivable = 0;
  let unpaidOrPartialPackageCount = 0;

  const packageStudentMap = new Map(students.map((s: any) => [String(s.id), s]));
  enrollments
    .filter(
      (e: any) =>
        !['DROPPED', 'CANCELLED', 'INACTIVE'].includes(String(e.enrollmentStatus || '').toUpperCase())
    )
    .forEach((e: any) => e.student?.id && packageStudentMap.set(String(e.student.id), e.student));

  Array.from(packageStudentMap.values()).forEach((s: any) => {
    if (!s?.id) return;
    const dbId = String(s.id).toLowerCase();
    const sNum = String(s.studentId || '').toLowerCase();
    const sName = String(s.fullName || '').trim().toLowerCase().replace(/\s+/g, ' ');

    const remitted =
      paidByDbStudentId[dbId] ??
      paidByStudentNumber[sNum] ??
      (studentNameCounts.get(sName) === 1 ? paidByUniqueStudentName[sName] : 0) ??
      0;
    const remaining = Math.max(0, roundMoney(termPkg.total - roundMoney(remitted)));

    if (remaining > 0) {
      unpaidOrPartialPackageCount++;
      totalPackageReceivable = roundMoney(totalPackageReceivable + remaining);
    }
  });

  if (unpaidOrPartialPackageCount > 0) {
    collectiblesMap[`Unsettled Departmental Fees (${term})`] = {
      category: `Unsettled Departmental Fees (${term})`,
      headcount: unpaidOrPartialPackageCount,
      total: roundMoney(totalPackageReceivable),
    };
  }

  const explicitCollectibleItemKeys = new Set(
    explicitCollectibles.map((ec: any) =>
      normalizeItemKey(
        (String(ec.category || '').startsWith('Arrears: ')
          ? String(ec.category).substring(9).split(' - ')[0]
          : ec.category) || 'Unassigned'
      )
    )
  );

  obligationGroups.forEach((group) => {
    const remaining = Math.max(0, roundMoney(group.assessedAmount - group.paidAmount));
    if (
      (remaining > 0 || group.hasOutstandingMarker) &&
      !explicitCollectibleItemKeys.has(normalizeItemKey(group.itemName))
    ) {
      if (!collectiblesMap[group.itemName]) {
        collectiblesMap[group.itemName] = { category: group.itemName, headcount: 0, total: 0 };
      }
      collectiblesMap[group.itemName].headcount++;
      collectiblesMap[group.itemName].total = roundMoney(
        collectiblesMap[group.itemName].total + (remaining > 0 ? remaining : group.assessedAmount)
      );
    }
  });

  explicitCollectibles.forEach((ec: any) => {
    const rawCat = String(ec.category || 'Unassigned').trim();
    const itemName = rawCat.startsWith('Arrears: ')
      ? rawCat.substring(9).split(' - ')[0] || rawCat
      : rawCat;
    if (!collectiblesMap[itemName]) {
      collectiblesMap[itemName] = { category: itemName, headcount: 0, total: 0 };
    }
    collectiblesMap[itemName].headcount += Number(ec.headcount) || 1;
    collectiblesMap[itemName].total = roundMoney(
      collectiblesMap[itemName].total + (Number(ec.balanceDue) || 0)
    );
  });

  const collectiblesList = Object.values(collectiblesMap);
  const totalCollectiblesSum = roundMoney(
    collectiblesList.reduce((sum, c) => sum + c.total, 0)
  );

  // 7. FUNDS, TRANSFERS & BALANCES (🚀 Fixed F43: Include initialAllocation and netTransfers)
  const initialAllocMap = initialFunds.reduce((acc: Record<string, number>, f: any) => {
    const n = String(f.fundName || '').trim();
    if (n) acc[n] = roundMoney((acc[n] || 0) + (Number(f.initialAllocation) || 0));
    return acc;
  }, {});

  const totalInitialAlloc = roundMoney(
    (Object.values(initialAllocMap) as number[]).reduce((s, a) => s + a, 0)
  );

  let carryOverInboundTotal = 0;
  const transferEffects = fundTransfers.reduce((acc: Record<string, number>, t: any) => {
    const amt = roundMoney(t.amount);
    if (amt > 0) {
      const src = String(t.sourceFund || '').trim();
      const dst = String(t.destinationFund || '').trim();
      if (src.toLowerCase().includes('rollover')) {
        if (dst) acc[dst] = roundMoney((acc[dst] || 0) + amt);
        carryOverInboundTotal = roundMoney(carryOverInboundTotal + amt);
      } else {
        if (src) acc[src] = roundMoney((acc[src] || 0) - amt);
        if (dst) acc[dst] = roundMoney((acc[dst] || 0) + amt);
      }
    }
    return acc;
  }, {});

  const fundsList = Array.from(
    new Set([
      ...Object.keys(collectionsByFund),
      ...Object.keys(expensesByFund),
      ...Object.keys(initialAllocMap),
      ...Object.keys(unliquidatedByFund),
      ...Object.keys(transferEffects),
    ])
  )
    .sort((a, b) => a.localeCompare(b))
    .map((name) => {
      const initialAllocation = roundMoney(initialAllocMap[name] || 0);
      const netTransfers = roundMoney(transferEffects[name] || 0);
      const collected = roundMoney(collectionsByFund[name] || 0);
      const spent = roundMoney(expensesByFund[name] || 0);
      const unliquidated = roundMoney(unliquidatedByFund[name] || 0);
      const balance = roundMoney(
        initialAllocation + collected - spent - unliquidated + netTransfers
      );
      return {
        name,
        initialAllocation,
        netTransfers,
        collected,
        spent,
        unliquidated,
        balance,
      };
    });

  const remainingBalance = roundMoney(
    totalInitialAlloc +
      grandCollectionTotal -
      grandExpenseTotal -
      totalUnliquidated +
      carryOverInboundTotal
  );

  // 8. FINAL RETURN
  return {
    grandCollectionTotal,
    grandExpenseTotal,
    totalUnliquidated,
    totalCollectibles: totalCollectiblesSum,
    remainingBalance,
    unliquidatedAdvances,
    collectionHierarchy,
    expensesByFund,
    collectiblesList,
    fundsList,
    termPkg,
    cashierBalance,
    totalDeposited,
    totalWithdrawn,
    unpaidPackageStudents: unpaidOrPartialPackageCount,
  };
}

export type DepartmentFinancials = Awaited<ReturnType<typeof computeDepartmentFinancials>>;
