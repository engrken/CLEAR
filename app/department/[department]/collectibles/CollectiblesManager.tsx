"use client";

import { useState } from "react";
import { fmt } from "@/lib/utils";
import { assessStudentDue } from "./actions";
import { ThemedAlert } from '@/lib/alerts';

interface Student { studentId: string; fullName: string; }
interface Collectible { 
  id: string; 
  studentId?: string | null;
  studentName?: string | null;
  category: string; 
  itemDescription?: string | null;
  amountDue?: number;
  balanceDue: number; 
  status?: string | null;
}
interface Fund { id: string; fundName: string; }

const otherFeesCatalog: Record<string, { name: string; rate: number; fund: string }[]> = {
  "Single Fee": [
    { name: "Gen Orientation Lunch", rate: 150.00, fund: "General Orientation Fund" },
    { name: "Fellowship Night", rate: 160.00, fund: "General Orientation Fund" }
  ],
  "Merchandise": [
    { name: "Departmental Shirt (Officer)", rate: 400.00, fund: "New Accounts (Current Operations)" },
    { name: "Departmental Shirt (Non - Officer)", rate: 450.00, fund: "New Accounts (Current Operations)" }
  ]
};

export default function CollectiblesManager({
  department,
  ay,
  term,
  students,
  collectibles,
  funds
}: {
  department: string;
  ay: string;
  term: string;
  students: Student[];
  collectibles: Collectible[];
  funds: Fund[];
}) {
  const todayStr = new Date().toISOString().split('T')[0];

  const [dueSearch, setDueSearch] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [category, setCategory] = useState("Single Fee");
  const [selectedItem, setSelectedItem] = useState(otherFeesCatalog["Single Fee"][0]?.name || "");
  const [customName, setCustomName] = useState("");
  const [amountDue, setAmountDue] = useState(otherFeesCatalog["Single Fee"][0]?.rate.toString() || "0");
  const [fundAllocation, setFundAllocation] = useState("General Orientation Fund");
  const [dueDate, setDueDate] = useState(todayStr);
  const [isSubmittingDue, setIsSubmittingDue] = useState(false);

  // Filter collectibles to show ONLY UNPAID items
  const unpaidCollectibles = collectibles.filter(c => {
    const st = c.status || 'Unpaid';
    return (c.balanceDue > 0 || st.includes('Unpaid')) && !st.includes('Paid');
  });

  const handleStudentSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDueSearch(val);
    const match = students.find(s => 
      `${s.fullName} (${s.studentId})`.toLowerCase() === val.toLowerCase() ||
      s.studentId.toLowerCase() === val.toLowerCase() ||
      s.fullName.toLowerCase() === val.toLowerCase()
    );
    if (match) {
      setStudentId(match.studentId);
      setStudentName(match.fullName);
    }
  };

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    const items = otherFeesCatalog[cat] || [];
    if (items.length > 0) {
      setSelectedItem(items[0].name);
      setAmountDue(items[0].rate.toString());
      setFundAllocation(items[0].fund);
    } else {
      setSelectedItem("CUSTOM");
      setAmountDue("0.00");
    }
  };

  const handleItemChange = (itemName: string) => {
    setSelectedItem(itemName);
    if (itemName === "CUSTOM") {
      setAmountDue("0.00");
    } else {
      const item = (otherFeesCatalog[category] || []).find(i => i.name === itemName);
      if (item) {
        setAmountDue(item.rate.toString());
        setFundAllocation(item.fund);
      }
    }
  };

  const handleAssessDue = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amountDue) || 0;
    const itemDesc = selectedItem === "CUSTOM" ? customName : selectedItem;

    if (!studentId || !itemDesc || amt <= 0) {
      return alert("Please provide a valid student, description, and amount greater than ₱0.00.");
    }

    setIsSubmittingDue(true);
    try {
      await assessStudentDue(department, {
        studentId,
        studentName,
        category,
        itemDescription: itemDesc,
        amountDue: amt,
        fundAllocation,
        date: dueDate,
        ay,
        term
      });
      alert(`Assessed ₱${amt.toFixed(2)} for ${itemDesc} to ${studentName}. Clearance hold active.`);
      setDueSearch("");
      setStudentId("");
      setStudentName("");
      setAmountDue("0");
      setCustomName("");
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSubmittingDue(false);
    }
  };

  return (
    <div>
      <div className="card p-3 border-info mb-4 shadow-sm bg-card">
        <h6 className="text-info fw-bold mb-1">Assess Activity, Merchandise, or Event Due</h6>
        <p className="text-secondary small mb-3">Immediately locks student clearance until settled.</p>

        <form onSubmit={handleAssessDue}>
          <div className="row g-2 mb-2">
            <div className="col-md-6">
              <label className="form-label text-secondary small fw-semibold">Date</label>
              <input type="date" className="form-control bg-card text-color border-secondary" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
            </div>
            <div className="col-md-6">
              <label className="form-label text-secondary small fw-semibold">Search Student</label>
              <input 
                list="dueStudentList" 
                className="form-control bg-card text-color border-secondary" 
                placeholder="Type name or ID..."
                value={dueSearch}
                onChange={handleStudentSearch}
                required 
              />
              <datalist id="dueStudentList">
                {students.map(s => <option key={s.studentId} value={`${s.fullName} (${s.studentId})`} />)}
              </datalist>
            </div>
          </div>

          <div className="row g-2 mb-2">
            <div className="col-md-6">
              <label className="form-label text-secondary small fw-semibold">Student ID</label>
              <input type="text" className="form-control bg-card text-secondary font-monospace border-secondary" value={studentId} readOnly />
            </div>
            <div className="col-md-6">
              <label className="form-label text-secondary small fw-semibold">Student Name</label>
              <input type="text" className="form-control bg-card text-secondary border-secondary" value={studentName} readOnly required />
            </div>
          </div>

          <div className="row g-2 mb-2">
            <div className="col-md-6">
              <label className="form-label text-secondary small fw-semibold">Category</label>
              <select className="form-select bg-card text-color border-secondary" value={category} onChange={e => handleCategoryChange(e.target.value)}>
                <option value="Single Fee">Individual Event Fee</option>
                <option value="Merchandise">Merchandise / Shirt</option>
                <option value="Others">Others / Custom Due</option>
              </select>
            </div>
            <div className="col-md-6">
              <label className="form-label text-secondary small fw-semibold">Item</label>
              <select className="form-select bg-card text-color border-secondary" value={selectedItem} onChange={e => handleItemChange(e.target.value)}>
                {(otherFeesCatalog[category] || []).map(i => (
                  <option key={i.name} value={i.name}>{i.name} (₱{i.rate.toFixed(2)})</option>
                ))}
                <option value="CUSTOM">-- Custom Activity / Fee --</option>
              </select>
            </div>
          </div>

          {selectedItem === "CUSTOM" && (
            <div className="mb-2">
              <label className="form-label text-secondary small fw-semibold">Custom Description</label>
              <input type="text" className="form-control bg-card text-color border-secondary" placeholder="e.g. Special Activity Dinner" value={customName} onChange={e => setCustomName(e.target.value)} required />
            </div>
          )}

          <div className="row g-2 mb-3">
            <div className="col-md-6">
              <label className="form-label text-secondary small fw-semibold">Amount Due (₱)</label>
              <input type="number" step="0.01" className="form-control bg-card text-color border-secondary" value={amountDue} onChange={e => setAmountDue(e.target.value)} required />
            </div>
            <div className="col-md-6">
              <label className="form-label text-secondary small fw-semibold">Fund Allocation Pool</label>
              <select className="form-select bg-card text-color border-secondary" value={fundAllocation} onChange={e => setFundAllocation(e.target.value)}>
                <option value="General Orientation Fund">General Orientation Fund</option>
                <option value="New Accounts (Current Operations)">New Accounts (Current Operations)</option>
                <option value="Others">Others</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-danger fw-bold w-100" disabled={isSubmittingDue}>
            {isSubmittingDue ? "Assessing..." : "Charge Due & Lock Clearance"}
          </button>
        </form>
      </div>

      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="text-secondary fw-bold m-0">Unpaid Receivables & Collectibles ({unpaidCollectibles.length})</h6>
      </div>

      <div className="table-responsive">
        <table className="table table-sm table-hover align-middle text-white w-100" style={{ fontSize: '0.85rem' }}>
          <thead>
            <tr className="text-secondary border-bottom border-secondary">
              <th className="py-2" style={{ width: '30%' }}>Student</th>
              <th className="py-2" style={{ width: '40%' }}>Category / Description</th>
              <th className="py-2 text-end" style={{ width: '15%' }}>Balance Due</th>
              <th className="py-2 text-center" style={{ width: '15%' }}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {unpaidCollectibles.length === 0 ? (
              <tr><td colSpan={4} className="text-center py-4 text-secondary">No unpaid receivables or collectibles recorded for this term.</td></tr>
            ) : (
              unpaidCollectibles.map(col => {
                let sId = col.studentId || '';
                let sName = col.studentName || 'Student';
                let desc = col.itemDescription || col.category;
                const amt = col.balanceDue || col.amountDue || 0;
                
                // Regex fallback parser for migrated legacy data
                if (!col.studentId || sName === 'Student') {
                  const match = desc.match(/(.+) - (.+) \((.+)\)$/);
                  if (match) {
                    desc = match[1].trim();
                    sName = match[2].trim();
                    sId = match[3].trim();
                  }
                }

                return (
                  <tr key={col.id} className="border-bottom border-secondary">
                    <td className="py-2">
                      <strong className="d-block text-truncate" style={{ maxWidth: '200px' }} title={sName}>{sName}</strong>
                      <span className="text-secondary font-monospace" style={{ fontSize: '0.75rem' }}>{sId || 'N/A'}</span>
                    </td>
                    <td className="py-2">
                      <div className="text-wrap text-break" style={{ maxWidth: '350px' }}>{desc}</div>
                    </td>
                    <td className="py-2 text-end text-warning fw-bold">{fmt(amt)}</td>
                    <td className="py-2 text-center">
                      <span className="badge bg-danger px-2 py-1" style={{ fontSize: '0.7rem' }}>Unpaid</span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}