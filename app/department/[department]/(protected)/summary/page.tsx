import { prisma } from '@/lib/prisma';
import SummaryClient from './SummaryClient';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Centralized Liquidation of Expenses & Audit Records',
};

export default async function SummaryReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ department: string }>;
  searchParams?: Promise<{ ay?: string; term?: string }>;
}) {
  const { department } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const ay = resolvedSearch.ay || 'A.Y. 2026 - 2027';
  const term = resolvedSearch.term || '1st Sem';

  const organization = await prisma.organization.findUnique({
    where: { subdomain: department },
  });

  if (!organization) {
    return <div className="alert alert-danger p-4">Department Not Found</div>;
  }

  // Term package configuration (Legacy Parity)
  const termPackages: Record<string, { total: number; items: { name: string; rate: number; fund: string }[] }> = {
    "1st Sem": {
      total: 650.00,
      items: [
        { name: "JIECEP FCUSC Membership Fee (Student & Institutional)", rate: 250.00, fund: "JIECEP Membership Fund" },
        { name: "General Orientation/Acquaintance Party", rate: 200.00, fund: "General Orientation Fund" },
        { name: "COE FCUSR Activities", rate: 100.00, fund: "FCUSR Activities Fund" },
        { name: "Sports and Cultural Fund", rate: 100.00, fund: "Sports & Cultural Fund" }
      ]
    },
    "2nd Sem": {
      total: 900.00,
      items: [
        { name: "JIECEP FCUSC Fund", rate: 50.00, fund: "JIECEP FCUSC Fund" },
        { name: "JIECEP Week Activities (Local & Regional)", rate: 150.00, fund: "JIECEP Week Activities Fund" },
        { name: "ECE Grand Ball", rate: 650.00, fund: "ECE Grandball Fund" },
        { name: "Emergency/Calamity Fund", rate: 30.00, fund: "Emergency/Calamity Fund" },
        { name: "FCUSR Activities & Projects", rate: 20.00, fund: "FCUSR Activities Fund" }
      ]
    },
    "Summer": {
      total: 200.00,
      items: [
        { name: "Summer Departmental Operations", rate: 150.00, fund: "New Accounts (Current Operations)" },
        { name: "Special Activities Fund", rate: 50.00, fund: "JIECEP Activities Fund" }
      ]
    }
  };

  const otherRates: Record<string, number> = {
    "Gen Orientation Lunch": 150.00,
    "Fellowship Night": 160.00,
    "Departmental Shirt (Officer)": 400.00,
    "Departmental Shirt (Non - Officer)": 450.00
  };

  // Fetch all required database records concurrently
  const [collections, audits, students, explicitCollectibles] = await Promise.all([
    prisma.collection.findMany({
      where: { organizationId: organization.id, academicYear: ay, term },
    }),
    prisma.audit.findMany({
      where: { organizationId: organization.id, academicYear: ay, term },
    }),
    prisma.student.findMany({
      where: { organizationId: organization.id },
    }),
    prisma.collectible.findMany({
      where: { organizationId: organization.id, academicYear: ay, term },
    }).catch(() => []),
  ]);

  const validCollections = collections.filter(c => !c.paymentType?.toUpperCase().includes('VOID'));
  const validAudits = audits.filter(a => !a.status?.includes('Void') && !a.status?.includes('Cancel'));

  const termPkg = termPackages[term] || termPackages["1st Sem"];
  const collectionHierarchy: Record<string, { count: number; total: number }> = {};
  const distinctStudents: Record<string, Set<string>> = {};
  let grandCollectionTotal = 0;

  // Helper with legacy student identifier matching (Name -> ID -> OR)
  const addCollectionItem = (itemName: string, amt: number, studentKey: string) => {
    if (!collectionHierarchy[itemName]) {
      collectionHierarchy[itemName] = { count: 0, total: 0 };
      distinctStudents[itemName] = new Set();
    }
    collectionHierarchy[itemName].total += amt;
    if (amt > 0 && studentKey) {
      distinctStudents[itemName].add(studentKey);
    }
  };

  validCollections.forEach(c => {
    const itemDesc = c.itemDescription?.trim() || 'General';
    const amt = Number(c.amountPaid) || 0;
    const studentKey = c.studentName ? c.studentName.trim().toLowerCase() : (c.studentId && c.studentId !== 'N/A' ? c.studentId.trim().toLowerCase() : c.orNumber);

    grandCollectionTotal += amt;

    const matchedPkgItem = termPkg.items.find(pi => pi.name.toLowerCase() === itemDesc.toLowerCase());

    if (matchedPkgItem) {
      addCollectionItem(matchedPkgItem.name, amt, studentKey);
    } else if (itemDesc === 'Departmental Fee Package' || itemDesc === 'Departmental Fee') {
      const pkgTotalRate = termPkg.total;
      termPkg.items.forEach(pi => {
        const share = (pi.rate / pkgTotalRate) * amt;
        addCollectionItem(pi.name, share, studentKey);
      });
    } else {
      addCollectionItem(itemDesc, amt, studentKey);
    }
  });

  Object.keys(collectionHierarchy).forEach(k => {
    collectionHierarchy[k].count = distinctStudents[k]?.size || 0;
  });

  // 2. Expenses Aggregation
  const expensesByFund: Record<string, number> = {};
  let grandExpenseTotal = 0;
  validAudits.forEach(a => {
    const fund = a.fundSource?.trim() || 'General Fund (Carried Over)';
    const exp = Number(a.totalExpense) || 0;
    expensesByFund[fund] = (expensesByFund[fund] || 0) + exp;
    grandExpenseTotal += exp;
  });

  // 3. Collectibles & Receivables (Accounting for unpaid & partial installments)
  const pkgTotal = termPkg.total;
  const paidPackageMap: Record<string, number> = {};

  // Track specific student obligations to prevent duplicates across tables
  const studentItemObligations: Record<string, Set<string>> = {}; 

  const addStudentObligation = (studentKey: string, itemName: string) => {
    if (!studentItemObligations[studentKey]) {
      studentItemObligations[studentKey] = new Set();
    }
    // Returns true if this is the first time we've seen this item for this student
    if (!studentItemObligations[studentKey].has(itemName)) {
      studentItemObligations[studentKey].add(itemName);
      return true; 
    }
    return false; // Already counted!
  };

  validCollections.forEach(c => {
    if (c.category === 'Departmental Fee' || c.category === 'Departmental Fee - Package' || termPkg.items.some(pi => pi.name.toLowerCase() === (c.itemDescription || '').toLowerCase())) {
      const sId = c.studentId?.trim().toLowerCase() || '';
      const sName = c.studentName?.trim().toLowerCase() || '';
      const paid = Number(c.amountPaid) || 0;
      const key = sName || (sId && sId !== 'n/a' ? sId : '');
      if (key) {
        paidPackageMap[key] = (paidPackageMap[key] || 0) + paid;
      }
    }
  });

  let unpaidOrPartialPackageCount = 0;
  let totalPackageReceivable = 0;

  students.forEach(s => {
    const sId = s.studentId?.trim().toLowerCase() || '';
    const sName = s.fullName?.trim().toLowerCase() || '';
    const key = sName || sId;
    const remitted = paidPackageMap[key] || 0;
    
    if (remitted < pkgTotal) {
      unpaidOrPartialPackageCount++;
      totalPackageReceivable += (pkgTotal - remitted);
      
      // Mark package as obligated for this student
      if (key) addStudentObligation(key, 'Departmental Fee');
    }
  });

  const collectiblesMap: Record<string, { category: string; headcount: number; total: number }> = {};

  if (unpaidOrPartialPackageCount > 0) {
    collectiblesMap[`Unsettled Departmental Fees (${term})`] = {
      category: `Unsettled Departmental Fees (${term})`,
      headcount: unpaidOrPartialPackageCount,
      total: totalPackageReceivable,
    };
  }

  // Parse partial payments from Collections table
  validCollections.forEach(c => {
    const balDue = Number(c.balanceDue) || 0;
    const pType = c.paymentType || '';
    const orNum = c.orNumber || '';
    const sId = c.studentId?.trim().toLowerCase() || '';
    const sName = c.studentName?.trim().toLowerCase() || '';
    const studentKey = sName || sId || `UNKNOWN-${c.id}`;
    
    if ((balDue > 0 || pType.includes('Unpaid') || orNum.startsWith('DUE-')) && 
        c.category !== 'Departmental Fee' && c.category !== 'Departmental Fee - Package') {
          
      const itemName = c.itemDescription || c.category || 'Other Due';
      
      // Only count if we haven't already processed this item for this student
      if (addStudentObligation(studentKey, itemName)) {
        if (!collectiblesMap[itemName]) {
          collectiblesMap[itemName] = { category: itemName, headcount: 0, total: 0 };
        }
        collectiblesMap[itemName].headcount += 1;
        collectiblesMap[itemName].total += balDue > 0 ? balDue : Number(c.standardRate || 0);
      }
    }
  });

  // Parse explicit records from Collectibles table
  explicitCollectibles.forEach((ec: any) => {
    let rawCat = ec.category?.trim() || 'Unassigned';
    let itemName = rawCat;
    
    // Clean up legacy arrears formatting
    if (rawCat.startsWith('Arrears: ')) {
      const core = rawCat.substring(9);
      const dashIdx = core.lastIndexOf(' - ');
      itemName = dashIdx !== -1 ? core.substring(0, dashIdx).trim() : core;
    }

    const headcount = ec.headcount || 1;
    const total = Number(ec.balanceDue) || Number(ec.total) || 0;
    
    // 1. Try to extract a real student identifier from the Collectible row
    const sId = ec.studentId?.trim().toLowerCase() || '';
    const sName = (ec.studentName || ec.fullName)?.trim().toLowerCase() || '';
    
    if (sId || sName) {
      // 2a. RECORD HAS A STUDENT: Deduplicate normally using their unique key
      const studentKey = sName || sId;
      
      if (addStudentObligation(studentKey, itemName)) {
        if (!collectiblesMap[itemName]) {
          collectiblesMap[itemName] = { category: itemName, headcount: 0, total: 0 };
        }
        collectiblesMap[itemName].headcount += headcount;
        collectiblesMap[itemName].total += total;
      }
    } else {
      // 2b. RECORD IS A HEADLESS AGGREGATE (No specific student attached):
      // Check if the detailed Collections loop already found students for this item.
      // If it did (e.g., Fellowship Night already exists), DO NOT add the duplicate aggregate!
      if (!collectiblesMap[itemName]) {
        collectiblesMap[itemName] = { category: itemName, headcount: 0, total: 0 };
        collectiblesMap[itemName].headcount += headcount;
        collectiblesMap[itemName].total += total;
      }
    }
  });

  const collectiblesList = Object.values(collectiblesMap);
  const totalCollectiblesSum = collectiblesList.reduce((sum, c) => sum + c.total, 0);

  return (
    <div className="mx-auto" style={{ maxWidth: '1150px', minWidth: 0 }}>
      <SummaryClient 
        department={department}
        ay={ay}
        term={term}
        termPkg={termPkg}
        otherRates={otherRates}
        collectionHierarchy={collectionHierarchy}
        grandCollectionTotal={grandCollectionTotal}
        expensesByFund={expensesByFund}
        grandExpenseTotal={grandExpenseTotal}
        collectibles={collectiblesList}
        totalCollectiblesSum={totalCollectiblesSum}
      />
    </div>
  );
}