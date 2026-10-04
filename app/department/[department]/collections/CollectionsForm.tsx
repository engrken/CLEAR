"use client";

import { useState, useMemo, useEffect } from "react";
import { fmt } from "@/lib/utils";
import { recordPayment } from "../actions";

interface Student { studentId: string; fullName: string; email: string | null; }
interface Fund { id: string; fundName: string; }

// Term Packages & Catalogs (Migrated from legacy config.js)[cite: 36]
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

const otherFees: Record<string, { name: string; rate: number; fund: string }[]> = {
  "Single Fee": [
    { name: "Gen Orientation Lunch", rate: 150.00, fund: "General Orientation Fund" },
    { name: "Fellowship Night", rate: 160.00, fund: "General Orientation Fund" }
  ],
  "Merchandise": [
    { name: "Departmental Shirt (Officer)", rate: 400.00, fund: "New Accounts (Current Operations)" },
    { name: "Departmental Shirt (Non - Officer)", rate: 450.00, fund: "New Accounts (Current Operations)" }
  ],
  "General Fund": [
    { name: "General Fund (Carried Over)", rate: 0.00, fund: "General Fund (Carried Over)" },
    { name: "New Accounts Inflow", rate: 0.00, fund: "New Accounts (Current Operations)" }
  ],
  "Others": [
    { name: "Penalty / Fines", rate: 0.00, fund: "Others" },
    { name: "Sponsorship / Donation", rate: 0.00, fund: "Others" },
    { name: "Miscellaneous Other Fee", rate: 0.00, fund: "Others" }
  ]
};

export default function CollectionsForm({
  department,
  ay,
  term,
  students,
  funds,
  nextOr,
  prefillId
}: {
  department: string;
  ay: string;
  term: string;
  students: Student[];
  funds: Fund[];
  nextOr: string;
  prefillId: string;
}) {
  const todayStr = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(todayStr);
  const [orNumber, setOrNumber] = useState(nextOr);
  const [searchQuery, setSearchQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  
  const [category, setCategory] = useState("Departmental Fee - Package");
  const [itemDescription, setItemDescription] = useState("Departmental Fee Package");
  const [paymentType, setPaymentType] = useState("Full Payment");
  const [amountPaid, setAmountPaid] = useState("");
  const [fundAllocation, setFundAllocation] = useState("Multi-Fund Allocation");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle prefill if redirected from penalties page
  useEffect(() => {
    if (prefillId) {
      const match = students.find(s => s.studentId.toLowerCase() === prefillId.toLowerCase());
      if (match) {
        setSearchQuery(`${match.fullName} (${match.studentId})`);
        setStudentId(match.studentId);
        setStudentName(match.fullName);
        setStudentEmail(match.email || "");
      }
      setCategory("Others");
      setItemDescription("Penalty / Fines");
    }
  }, [prefillId, students]);

  // Active Package or Catalog Rate Calculation
  const standardRate = useMemo(() => {
    if (category === "Departmental Fee - Package") {
      return (termPackages[term] || termPackages["1st Sem"]).total;
    }
    const list = otherFees[category] || [];
    const found = list.find(i => i.name === itemDescription);
    return found ? found.rate : 0;
  }, [category, itemDescription, term]);

  // Set default amount when category/item changes
  useEffect(() => {
    if (paymentType === "Full Payment" || paymentType === "Balance") {
      setAmountPaid(standardRate.toFixed(2));
    }
  }, [standardRate, paymentType]);

  const remainingBalance = Math.max(0, standardRate - (parseFloat(amountPaid) || 0));

  // Student Search Handler
  const handleStudentSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    const match = students.find(s => 
      `${s.fullName} (${s.studentId})`.toLowerCase() === val.toLowerCase() ||
      s.studentId.toLowerCase() === val.toLowerCase() ||
      s.fullName.toLowerCase() === val.toLowerCase()
    );
    if (match) {
      setStudentId(match.studentId);
      setStudentName(match.fullName);
      setStudentEmail(match.email || "");
    }
  };

  // Category Change Handler
  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    if (cat === "Departmental Fee - Package") {
      setItemDescription("Departmental Fee Package");
      setFundAllocation("Multi-Fund Allocation");
    } else {
      const items = otherFees[cat] || [];
      if (items.length > 0) {
        setItemDescription(items[0].name);
        setFundAllocation(items[0].fund);
      }
    }
  };

  // Item Change Handler
  const handleItemChange = (itemName: string) => {
    setItemDescription(itemName);
    const item = (otherFees[category] || []).find(i => i.name === itemName);
    if (item) {
      setFundAllocation(item.fund);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paid = parseFloat(amountPaid) || 0;

    if (!studentId || paid <= 0) {
      return alert("Please select a valid student and enter an amount greater than ₱0.00.");
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
        term
      });

      alert(`Payment successfully recorded under OR #${orNumber}! Digital receipt dispatched.`);
      // Reset form partially
      setAmountPaid("");
      setSearchQuery("");
      setStudentId("");
      setStudentName("");
      setStudentEmail("");
    } catch (err: any) {
      alert("Error recording payment: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="row g-2 mb-2">
        <div className="col-md-6">
          <label className="form-label text-secondary small fw-semibold">Date</label>
          <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} required />
        </div>
        <div className="col-md-6">
          <label className="form-label text-secondary small fw-semibold">OR Number</label>
          <input type="text" className="form-control font-monospace" value={orNumber} onChange={e => setOrNumber(e.target.value)} required />
        </div>
      </div>

      <div className="mb-2">
        <label className="form-label text-secondary small fw-semibold">Search Student (ID or Name)</label>
        <input 
          list="collectionStudentList" 
          className="form-control" 
          placeholder="Start typing student name or ID..."
          value={searchQuery}
          onChange={handleStudentSearch}
          required 
        />
        <datalist id="collectionStudentList">
          {students.map(s => <option key={s.studentId} value={`${s.fullName} (${s.studentId})`} />)}
        </datalist>
      </div>

      <div className="row g-2 mb-2">
        <div className="col-md-4">
          <label className="form-label text-secondary small fw-semibold">Student ID</label>
          <input type="text" className="form-control text-secondary" value={studentId} readOnly />
        </div>
        <div className="col-md-4">
          <label className="form-label text-secondary small fw-semibold">Full Name</label>
          <input type="text" className="form-control" value={studentName} onChange={e => setStudentName(e.target.value)} required />
        </div>
        <div className="col-md-4">
          <label className="form-label text-secondary small fw-semibold">Notification Email</label>
          <input type="email" className="form-control" value={studentEmail} onChange={e => setStudentEmail(e.target.value)} placeholder="student@example.com" />
        </div>
      </div>

      <div className="mb-2">
        <label className="form-label text-secondary small fw-semibold">Collection Type</label>
        <select className="form-select" value={category} onChange={e => handleCategoryChange(e.target.value)} required>
          <option value="Departmental Fee - Package">Departmental Fee (Package)</option>
          <option value="Single Fee">Individual Fee</option>
          <option value="Merchandise">Merchandise</option>
          <option value="General Fund">General Fund</option>
          <option value="Others">Others</option>
        </select>
      </div>

      {category !== "Departmental Fee - Package" ? (
        <div className="mb-2">
          <label className="form-label text-secondary small fw-semibold">Item Description</label>
          <select className="form-select" value={itemDescription} onChange={e => handleItemChange(e.target.value)}>
            {(otherFees[category] || []).map(i => <option key={i.name} value={i.name}>{i.name} (₱{i.rate.toFixed(2)})</option>)}
          </select>
        </div>
      ) : (
        <div className="alert alert-info py-2 small mb-2">
          <strong>{term} Breakdown (Total: {fmt((termPackages[term] || termPackages["1st Sem"]).total)}):</strong><br />
          {(termPackages[term] || termPackages["1st Sem"]).items.map((i, idx) => (
            <span key={idx}>• {i.name}: {fmt(i.rate)} &rarr; <em>{i.fund}</em><br /></span>
          ))}
        </div>
      )}

      <div className="row g-2 mb-2">
        <div className="col-md-4">
          <label className="form-label text-secondary small fw-semibold">Payment Mode</label>
          <select className="form-select" value={paymentType} onChange={e => setPaymentType(e.target.value)} required>
            <option value="Full Payment">Full Payment</option>
            <option value="Partial Payment">Partial Payment / Installment</option>
            <option value="Balance">Balance</option>
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label text-secondary small fw-semibold">Standard Rate / Balance (₱)</label>
          <input type="number" step="0.01" className="form-control text-secondary" readOnly value={standardRate.toFixed(2)} />
        </div>
        <div className="col-md-4">
          <label className="form-label text-secondary small fw-semibold">Amount Paid Now (₱)</label>
          <input type="number" step="0.01" className="form-control" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} required />
        </div>
      </div>

      {paymentType !== "Full Payment" && parseFloat(amountPaid) > 0 && standardRate > 0 && (
        <div className="alert alert-danger py-2 small fw-bold mb-2">
          REMAINING BALANCE DUE: {fmt(remainingBalance)}
        </div>
      )}

      {category !== "Departmental Fee - Package" && (
        <div className="mb-3">
          <label className="form-label text-secondary small fw-semibold">Target Fund Allocation</label>
          <select className="form-select" value={fundAllocation} onChange={e => setFundAllocation(e.target.value)}>
            {funds.map(f => <option key={f.id} value={f.fundName}>{f.fundName}</option>)}
            <option value="Others">Others</option>
          </select>
        </div>
      )}

      <button type="submit" className="btn btn-info fw-bold w-100" disabled={isSubmitting}>
        {isSubmitting ? "Recording Payment..." : "Post Payment & Send Digital Receipt"}
      </button>
    </form>
  );
}