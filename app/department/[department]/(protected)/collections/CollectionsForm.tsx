"use client";

import { useState, useMemo, useEffect } from "react";
import { fmt } from "@/lib/utils";
import { recordPayment } from "../../actions";

interface Student {
  studentId: string;
  fullName: string;
  email: string | null;
}

interface Fund {
  id: string;
  fundName: string;
}

interface CollectionSetup {
  id: string;
  category: string;
  name: string;
  amount: number;
  targetFund: string;
  isPackage?: boolean;
}

const DEPARTMENTAL_PACKAGE_NAME = "Departmental Fee Package (All Items)";

export default function CollectionsForm({
  department,
  ay,
  term,
  students,
  funds,
  collectionItems,
  nextOr,
  prefillId,
}: {
  department: string;
  ay: string;
  term: string;
  students: Student[];
  funds: Fund[];
  collectionItems: CollectionSetup[];
  nextOr: string;
  prefillId: string;
}) {
  const todayStr = new Date().toISOString().split("T")[0];

  const categories: string[] = useMemo(() => {
    return Array.from(new Set(collectionItems.map((item) => String(item.category))));
  }, [collectionItems]);

  const [date, setDate] = useState(todayStr);
  const [orNumber, setOrNumber] = useState(nextOr);

  const [searchQuery, setSearchQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");

  const [category, setCategory] = useState(categories[0] || "");
  const [itemDescription, setItemDescription] = useState("");

  const [paymentType, setPaymentType] = useState("Full Payment");
  const [amountPaid, setAmountPaid] = useState("");
  const [fundAllocation, setFundAllocation] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter items belonging to the currently selected category drop-down
  const currentCategoryItems = useMemo(() => {
    return collectionItems.filter((item) => item.category === category);
  }, [category, collectionItems]);

  // Use the NEW architecture: Filter by isPackage boolean instead of strings!
  const packageItems = useMemo(() => {
    return currentCategoryItems.filter((item) => item.isPackage !== false);
  }, [currentCategoryItems]);

  const packageTotal = useMemo(() => {
    return packageItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }, [packageItems]);

  useEffect(() => {
    if (currentCategoryItems.length === 0) {
      setItemDescription("");
      setFundAllocation("");
      return;
    }

    // Default to the "Choose All" package if there are multiple mandatory items in this category
    if (packageItems.length > 1) {
      setItemDescription(DEPARTMENTAL_PACKAGE_NAME);
      setFundAllocation("Multiple Funds (Package Split)");
      return;
    }

    setItemDescription(currentCategoryItems[0].name);
    setFundAllocation(currentCategoryItems[0].targetFund);
  }, [category, currentCategoryItems, packageItems]);

  useEffect(() => {
    if (!prefillId) return;

    const match = students.find((s) => s.studentId.toLowerCase() === prefillId.toLowerCase());
    if (match) {
      setSearchQuery(`${match.fullName} (${match.studentId})`);
      setStudentId(match.studentId);
      setStudentName(match.fullName);
      setStudentEmail(match.email || "");
    }

    const penaltyCategory = categories.find((c) => c.toLowerCase().includes("penalty"));
    if (penaltyCategory) setCategory(penaltyCategory);
  }, [prefillId, students, categories]);

  const standardRate = useMemo(() => {
    if (itemDescription === DEPARTMENTAL_PACKAGE_NAME) return packageTotal;
    const found = currentCategoryItems.find((item) => item.name === itemDescription);
    return found ? Number(found.amount || 0) : 0;
  }, [itemDescription, currentCategoryItems, packageTotal]);

  useEffect(() => {
    if (paymentType === "Full Payment" || paymentType === "Balance") {
      setAmountPaid(standardRate.toFixed(2));
    }
  }, [standardRate, paymentType]);

  const remainingBalance = Math.max(0, standardRate - (parseFloat(amountPaid) || 0));

  const handleStudentSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    const match = students.find((s) => 
        `${s.fullName} (${s.studentId})`.toLowerCase().includes(val.toLowerCase()) ||
        s.studentId.toLowerCase() === val.toLowerCase() ||
        s.fullName.toLowerCase() === val.toLowerCase()
    );
    if (match) {
      setStudentId(match.studentId);
      setStudentName(match.fullName);
      setStudentEmail(match.email || "");
    }
  };

  const handleItemChange = (itemName: string) => {
    setItemDescription(itemName);
    if (itemName === DEPARTMENTAL_PACKAGE_NAME) {
      setFundAllocation("Multiple Funds (Package Split)");
      return;
    }
    const item = currentCategoryItems.find((i) => i.name === itemName);
    if (item) setFundAllocation(item.targetFund);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paid = parseFloat(amountPaid) || 0;

    if (!studentId) return alert("Please select a valid student.");
    if (paid <= 0) return alert("Please enter an amount greater than ₱0.00.");
    if (paid > standardRate) return alert(`Amount paid cannot exceed the standard rate of ${fmt(standardRate)}.`);

    if (itemDescription === DEPARTMENTAL_PACKAGE_NAME && packageTotal <= 0) {
      return alert("The Package has no configured mandatory items for this category.");
    }

    setIsSubmitting(true);
    try {
      await recordPayment(department, {
        orNumber,
        date,
        studentId,
        studentName,
        studentEmail,
        category,
        itemDescription,
        paymentType,
        standardRate,
        amountPaid: paid,
        fundAllocation,
        ay,
        term,
      });

      alert(`Payment successfully recorded under OR #${orNumber}! Digital receipt dispatched.`);
      setAmountPaid("");
      setSearchQuery("");
      setStudentId("");
      setStudentName("");
      setStudentEmail("");

      // Increment OR Number locally for quick successive entries
      const parts = orNumber.split("-");
      if (parts.length > 1) {
        const numPart = parseInt(parts[1].replace(/[^0-9]/g, ""), 10);
        if (!isNaN(numPart)) {
          const nextNum = numPart + 1;
          setOrNumber(`${parts[0]}-${nextNum < 1000 ? String(nextNum).padStart(3, "0") : nextNum}`);
        }
      }

    } catch (err: any) {
      alert("Error recording payment: " + (err?.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (collectionItems.length === 0) {
    return (
      <div className="alert alert-warning py-3 small">
        <i className="bi bi-exclamation-triangle me-2"></i>
        No collections have been setup for this department yet. Please visit the Setup module to configure fees.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="row g-2 mb-2">
        <div className="col-md-6">
          <label className="form-label text-secondary small fw-semibold">Date</label>
          <input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="col-md-6">
          <label className="form-label text-secondary small fw-semibold">OR Number</label>
          <input type="text" className="form-control font-monospace border-warning" value={orNumber} onChange={(e) => setOrNumber(e.target.value)} required />
        </div>
      </div>

      <div className="mb-2">
        <label className="form-label text-secondary small fw-semibold">Search Student (ID or Name)</label>
        <input list="collectionStudentList" className="form-control border-info" placeholder="Start typing student name or ID..." value={searchQuery} onChange={handleStudentSearch} required />
        <datalist id="collectionStudentList">
          {students.map((s) => (
            <option key={s.studentId} value={`${s.fullName} (${s.studentId})`} />
          ))}
        </datalist>
      </div>

      <div className="row g-2 mb-2">
        <div className="col-md-4">
          <label className="form-label text-secondary small fw-semibold">Student ID</label>
          <input type="text" className="form-control text-secondary bg-dark" value={studentId} readOnly />
        </div>
        <div className="col-md-4">
          <label className="form-label text-secondary small fw-semibold">Full Name</label>
          <input type="text" className="form-control bg-dark text-white" value={studentName} onChange={(e) => setStudentName(e.target.value)} required />
        </div>
        <div className="col-md-4">
          <label className="form-label text-secondary small fw-semibold">Notification Email</label>
          <input type="email" className="form-control bg-dark text-white" value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)} placeholder="student@example.com" />
        </div>
      </div>

      <div className="mb-2">
        <label className="form-label text-secondary small fw-semibold">Collection Category</label>
        <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value)} required>
          {categories.map((cat) => {
            const hasPackageItems = collectionItems.some(i => i.category === cat && i.isPackage !== false);
            return (
              <option key={cat} value={cat}>
                {cat} {hasPackageItems ? " — (Contains Mandatory Items)" : " — (Optional / Standalone)"}
              </option>
            );
          })}
        </select>
      </div>

      <div className="mb-2">
        <label className="form-label text-secondary small fw-semibold">Item Description</label>
        <select className="form-select" value={itemDescription} onChange={(e) => handleItemChange(e.target.value)} required>
          {packageItems.length > 1 && (
            <option value={DEPARTMENTAL_PACKAGE_NAME}>
              ⭐ {DEPARTMENTAL_PACKAGE_NAME} — {fmt(packageTotal)}
            </option>
          )}
          {currentCategoryItems.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name} ({fmt(item.amount)}) {item.isPackage === false ? " [Optional]" : ""}
            </option>
          ))}
        </select>
      </div>

      {itemDescription === DEPARTMENTAL_PACKAGE_NAME && (
        <div className="alert alert-info py-2 small mb-2 border-info">
          <div className="fw-bold mb-1">Mandatory Clearance Package Breakdown</div>
          <div className="mb-1 text-secondary">This package auto-splits the payment into the following target funds:</div>
          <div className="mt-2">
            {packageItems.map((item) => (
              <div key={item.id} className="d-flex justify-content-between text-info">
                <span>{item.name}</span>
                <span className="fw-semibold">{fmt(item.amount)}</span>
              </div>
            ))}
          </div>
          <hr className="my-2 border-info border-opacity-50" />
          <div className="d-flex justify-content-between fw-bold text-info">
            <span>MANDATORY TOTAL</span>
            <span>{fmt(packageTotal)}</span>
          </div>
        </div>
      )}

      <div className="row g-2 mb-2">
        <div className="col-md-4">
          <label className="form-label text-secondary small fw-semibold">Payment Mode</label>
          <select className="form-select" value={paymentType} onChange={(e) => setPaymentType(e.target.value)} required>
            <option value="Full Payment">Full Payment</option>
            <option value="Partial Payment">Partial Payment / Installment</option>
            <option value="Balance">Balance</option>
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label text-secondary small fw-semibold">Standard Rate (₱)</label>
          <input type="number" step="0.01" className="form-control text-white bg-dark" readOnly value={standardRate.toFixed(2)} />
        </div>
        <div className="col-md-4">
          <label className="form-label text-info fw-bold small">Amount Paid Now (₱)</label>
          <input type="number" step="0.01" min="0" className="form-control border-info fw-bold text-info" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} required />
        </div>
      </div>

      {paymentType !== "Full Payment" && parseFloat(amountPaid) > 0 && standardRate > 0 && (
        <div className="alert alert-danger py-2 small fw-bold mb-2 border-danger">
          REMAINING BALANCE DUE: {fmt(remainingBalance)}
        </div>
      )}

      <div className="mb-3">
        <label className="form-label text-secondary small fw-semibold">Target Fund Allocation</label>
        <select className="form-select text-white bg-dark" value={fundAllocation} onChange={(e) => setFundAllocation(e.target.value)} required>
          {fundAllocation === "Multiple Funds (Package Split)" && (
            <option value="Multiple Funds (Package Split)">Multiple Funds (Package Split)</option>
          )}
          {funds.map((fund) => (
            <option key={fund.id} value={fund.fundName}>{fund.fundName}</option>
          ))}
          <option value="Others">Others</option>
        </select>
      </div>

      <button type="submit" className="btn btn-info fw-bold w-100" disabled={isSubmitting}>
        {isSubmitting ? "Recording Payment..." : "Post Payment & Send Digital Receipt"}
      </button>
    </form>
  );
}