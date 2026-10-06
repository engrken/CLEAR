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
    
    // For explicit collectibles, we assume they might not have a specific student linked 
    // in this table, so we use a fallback ID to ensure they get counted if headcount > 0
    const fakeStudentKey = `EXPLICIT-${ec.id}`;

    if (addStudentObligation(fakeStudentKey, itemName)) {
      if (!collectiblesMap[itemName]) {
        collectiblesMap[itemName] = { category: itemName, headcount: 0, total: 0 };
      }
      collectiblesMap[itemName].headcount += headcount;
      collectiblesMap[itemName].total += total;
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