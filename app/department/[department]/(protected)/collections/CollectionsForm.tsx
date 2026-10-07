"use client";

import { useState, useMemo, useEffect, FormEvent } from "react";
import { recordPayment } from "../../actions";
import { useRouter } from "next/navigation";

export default function CollectionsForm({
  department,
  ay,
  term,
  students,
  funds,
  collectionItems,
  nextOr,
  prefillId
}: any) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [orNumber, setOrNumber] = useState(nextOr);
  
  const categories = Array.from(new Set(collectionItems.map((c: any) => c.category)));
  const [category, setCategory] = useState(categories[0] || "Departmental Fee");
  const [itemDescription, setItemDescription] = useState("");
  
  const [paymentType, setPaymentType] = useState("Full Payment");
  const [amountPaid, setAmountPaid] = useState("");
  const [fundAllocation, setFundAllocation] = useState("");

  const currentCategoryItems = useMemo(() => {
    return collectionItems.filter((c: any) => c.category === category);
  }, [collectionItems, category]);

  // 1. Isolate the mandatory items to calculate the true package total
  const packageItems = useMemo(() => {
    return currentCategoryItems.filter((i: any) => i.isPackage !== false);
  }, [currentCategoryItems]);

  const packageTotal = packageItems.reduce((sum: number, i: any) => sum + i.amount, 0);

  // 2. Calculate the exact standard rate for the form
  const standardRate = useMemo(() => {
    if (itemDescription === "Departmental Fee Package (All Items)") return packageTotal;
    const found = currentCategoryItems.find((i: any) => i.name === itemDescription);
    return found ? found.amount : 0;
  }, [currentCategoryItems, itemDescription, packageTotal]);

  useEffect(() => {
    if (currentCategoryItems.length > 0) {
      // Default to "Choose All" if it's a fee category, otherwise default to first item
      const defaultItem = category.toLowerCase().includes("fee") && packageItems.length > 1 
        ? "Departmental Fee Package (All Items)" 
        : currentCategoryItems[0].name;
      setItemDescription(defaultItem);
      
      if (defaultItem === "Departmental Fee Package (All Items)") {
        setFundAllocation("Multiple Funds (Package Split)");
      } else {
        setFundAllocation(currentCategoryItems[0].targetFund);
      }
    }
  }, [category, currentCategoryItems, packageItems]);

  useEffect(() => {
    if (paymentType === "Full Payment") {
      setAmountPaid(standardRate.toString());
    }
  }, [standardRate, paymentType]);

  const remainingBalance = Math.max(0, standardRate - (parseFloat(amountPaid) || 0));

  const handleItemChange = (val: string) => {
    setItemDescription(val);
    if (val === "Departmental Fee Package (All Items)") {
      setFundAllocation("Multiple Funds (Package Split)");
    } else {
      const item = currentCategoryItems.find((i: any) => i.name === val);
      if (item) setFundAllocation(item.targetFund);
    }
  };

  const handleStudentSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    const match = students.find((s: any) => 
      `${s.fullName} (${s.studentId})`.toLowerCase().includes(val.toLowerCase()) ||
      s.studentId.toLowerCase() === val.toLowerCase() ||
      s.fullName.toLowerCase() === val.toLowerCase()
    );
    if (match) {
      setStudentId(match.studentId);
      setStudentName(match.fullName);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await recordPayment(department, {
        orNumber,
        date,
        studentId,
        studentName,
        category,
        itemDescription,
        paymentType,
        standardRate,
        amountPaid: parseFloat(amountPaid) || 0,
        fundAllocation,
        ay,
        term
      });
      alert("Payment recorded successfully!");
      router.refresh();
      setSearchQuery("");
      setStudentId("");
      setStudentName("");
      setAmountPaid(standardRate.toString());
    } catch (err: any) {
      alert(err.message || "Failed to record payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const fmt = (num: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(num);

  return (
    <form onSubmit={handleSubmit} className="row g-3 text-white">
      <div className="col-md-4">
        <label className="form-label text-secondary small fw-semibold">Date</label>
        <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} required />
      </div>
      <div className="col-md-8">
        <label className="form-label text-secondary small fw-semibold">Search Student</label>
        <input type="text" className="form-control border-info" placeholder="Start typing student name or ID..." value={searchQuery} onChange={handleStudentSearch} />
      </div>
      <div className="col-md-4">
        <label className="form-label text-secondary small fw-semibold">Student ID</label>
        <input type="text" className="form-control bg-dark text-white" value={studentId} readOnly required />
      </div>
      <div className="col-md-8">
        <label className="form-label text-secondary small fw-semibold">Full Name</label>
        <input type="text" className="form-control bg-dark text-white" value={studentName} readOnly required />
      </div>

      <div className="col-md-12">
        <label className="form-label text-secondary small fw-semibold">Collection Category</label>
        <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
          {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="col-md-12">
        <label className="form-label text-secondary small fw-semibold">Item Description</label>
        <select className="form-select" value={itemDescription} onChange={e => handleItemChange(e.target.value)}>
          {category.toLowerCase().includes("fee") && packageItems.length > 1 && (
            <option value="Departmental Fee Package (All Items)">
              ⭐ Departmental Fee Package (All Items) — {fmt(packageTotal)}
            </option>
          )}
          {currentCategoryItems.map((i: any) => (
            <option key={i.name} value={i.name}>
              {i.name} ({fmt(i.amount)}) {i.isPackage === false ? ' [Optional / Standalone]' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="col-md-6">
        <label className="form-label text-secondary small fw-semibold">Payment Type</label>
        <select className="form-select" value={paymentType} onChange={e => setPaymentType(e.target.value)}>
          <option value="Full Payment">Full Payment</option>
          <option value="Partial Payment">Partial Payment</option>
        </select>
      </div>
      <div className="col-md-6">
        <label className="form-label text-secondary small fw-semibold">Standard Rate</label>
        <input type="text" className="form-control bg-dark text-white" value={fmt(standardRate)} readOnly />
      </div>

      <div className="col-md-6">
        <label className="form-label text-info small fw-bold">Amount Paid</label>
        <input type="number" className="form-control border-info fw-bold text-info" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} required min="1" max={standardRate} />
      </div>
      <div className="col-md-6">
        <label className="form-label text-secondary small fw-semibold">Balance Due</label>
        <input type="text" className={`form-control bg-dark fw-bold ${remainingBalance > 0 ? 'text-danger' : 'text-success'}`} value={fmt(remainingBalance)} readOnly />
      </div>

      <div className="col-md-8">
        <label className="form-label text-secondary small fw-semibold">Target Fund Allocation</label>
        <input type="text" className="form-control bg-dark text-white" value={fundAllocation} readOnly />
      </div>
      <div className="col-md-4">
        <label className="form-label text-secondary small fw-semibold">OR Number</label>
        <input type="text" className="form-control border-warning" value={orNumber} onChange={e => setOrNumber(e.target.value)} required />
      </div>

      <div className="col-12 mt-4 text-end">
        <button type="submit" className="btn btn-info fw-bold w-100" disabled={isSubmitting}>
          {isSubmitting ? "Processing..." : "Record Payment & Issue OR"}
        </button>
      </div>
    </form>
  );
        }
