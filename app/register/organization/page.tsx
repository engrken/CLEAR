'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

type Registration = {
 organizationName:string; subdomain:string; type:'Department'|'Organization';
 adminName:string; adminEmail:string; academicYear:string; calendarMode:'Semester'|'Trimester'|'FullYear';
};
const initial:Registration={organizationName:'',subdomain:'',type:'Organization',adminName:'',adminEmail:'',academicYear:'A.Y. 2026 - 2027',calendarMode:'Semester'};
export default function OrganizationRegistrationPage() {
 const [details,setDetails]=useState<Registration>(initial);
 const [id,setId]=useState('');
 const [code,setCode]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [done,setDone]=useState('');
 const [message,setMessage]=useState('');
 const update=(name:keyof Registration,value:string)=>setDetails(current=>({...current,[name]:value}));
 async function register(e:FormEvent<HTMLFormElement>) {
  e.preventDefault();setBusy(true);setError('');
  try {
   const response=await fetch('/api/public/organization-registration',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(details)});
   const body=await response.json();
   if(!response.ok)throw new Error(body.error||'Registration failed.');
   setId(body.id);setMessage(body.message);
  }catch(err){setError(err instanceof Error?err.message:'Registration failed.');}
  finally{setBusy(false);}
 }
 async function verify(e:FormEvent<HTMLFormElement>) {
  e.preventDefault();setBusy(true);setError('');
  try {
   const response=await fetch('/api/public/organization-registration/verify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,code})});
   const body=await response.json();
   if(!response.ok)throw new Error(body.error||'Verification failed.');
   setDone(body.department);
  }catch(err){setError(err instanceof Error?err.message:'Verification failed.');}
  finally{setBusy(false);}
 }
 return <main className="min-vh-100 bg-canvas text-color py-5">
  <div className="container" style={{maxWidth:980}}>
   <Link href="/dashboard" className="text-info text-decoration-none">← Back to organization directory</Link>
   <header className="text-center my-5">
    <span className="badge bg-info bg-opacity-10 text-info border border-info mb-3">CLEAR SYSTEM • INSTITUTIONAL ONBOARDING</span>
    <h1 className="fw-bold display-6">Register your organization</h1>
    <p className="text-secondary">Get started with Freemium. No subscription payment is required.</p>
   </header>
   <div className="row g-4">
    <div className="col-lg-7">
     <section className="card border-secondary shadow-lg p-4">
      {done ? <>
        <h2 className="h4 text-success">Organization created successfully</h2>
        <p>Freemium is active. Sign in with your verified administrator email to configure your workspace.</p>
        <Link className="btn btn-info" href={`/department/${encodeURIComponent(done)}`}>Open organization portal</Link>
      </> : id ? <>
        <h2 className="h4">Verify administrator email</h2>
        <p className="text-secondary small">{message} Enter the six-digit code sent to {details.adminEmail}.</p>
        <form onSubmit={verify}>
         <label htmlFor="verification-code" className="form-label">Verification code</label>
         <input id="verification-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
          className="form-control mb-3" value={code} onChange={e=>setCode(e.target.value)} required />
         <button disabled={busy} className="btn btn-info w-100">{busy?'Verifying…':'Verify and create Freemium workspace'}</button>
        </form>
        <button type="button" className="btn btn-link mt-2" onClick={()=>{setId('');setCode('');setError('');}}>Edit details / request a new code</button>
      </> : <>
       <h2 className="h4 mb-3">Organization and administrator details</h2>
       <form onSubmit={register}>
        <label htmlFor="org-name" className="form-label">Organization / school name</label>
        <input id="org-name" className="form-control mb-3" maxLength={150} required value={details.organizationName} onChange={e=>update('organizationName',e.target.value)} />
        <label htmlFor="org-slug" className="form-label">Organization URL identifier</label>
        <div className="input-group mb-1"><span className="input-group-text">/department/</span>
         <input id="org-slug" className="form-control" maxLength={63} pattern="[a-z0-9]+(-[a-z0-9]+)*" required value={details.subdomain}
          onChange={e=>update('subdomain',e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,''))} />
        </div>
        <p className="text-secondary small mb-3">Use a unique short name, such as engineering-council.</p>
        <label htmlFor="org-type" className="form-label">Entity type</label>
        <select id="org-type" className="form-select mb-3" value={details.type} onChange={e=>update('type',e.target.value)}>
         <option value="Organization">Student organization / association</option><option value="Department">School / department</option>
        </select>
        <label htmlFor="admin-name" className="form-label">Administrator&apos;s full name</label>
        <input id="admin-name" className="form-control mb-3" required maxLength={150} value={details.adminName} onChange={e=>update('adminName',e.target.value)} />
        <label htmlFor="admin-email" className="form-label">Administrator&apos;s email</label>
        <input id="admin-email" type="email" className="form-control mb-3" required maxLength={254} autoComplete="email" value={details.adminEmail} onChange={e=>update('adminEmail',e.target.value)} />
        <label htmlFor="academic-year" className="form-label">Initial academic year</label>
        <input id="academic-year" className="form-control mb-3" required value={details.academicYear} onChange={e=>update('academicYear',e.target.value)} />
        <label htmlFor="calendar-mode" className="form-label">Academic calendar</label>
        <select id="calendar-mode" className="form-select mb-3" value={details.calendarMode} onChange={e=>update('calendarMode',e.target.value)}>
         <option value="Semester">Semester</option><option value="Trimester">Trimester</option><option value="FullYear">Full Year</option>
        </select>
        <p className="small text-secondary">By registering, you confirm you are authorized to manage this entity. Email verification establishes email control, not legal affiliation with a school.</p>
        <button disabled={busy} className="btn btn-info w-100 fw-bold">{busy?'Submitting…':'Continue to email verification'}</button>
       </form>
      </>}
      {error && <div role="alert" className="alert alert-danger mt-3 mb-0">{error}</div>}
     </section>
    </div>
    <aside className="col-lg-5">
     <section className="card p-4 border-info mb-3">
      <span className="badge bg-success align-self-start mb-2">DEFAULT PLAN</span>
      <h2 className="h4">Freemium</h2>
      <p className="fs-4 fw-bold mb-2">Free</p>
      <p className="text-secondary small">Start managing student organizations and department operations.</p>
      <ul className="small mb-0"><li>Up to 2 entities per school group</li><li>Role-based organization administration</li><li>Student roster and clearance workflows</li><li>Financial record management subject to permissions</li></ul>
     </section>
     <section className="card p-4 border-secondary mb-3"><h3 className="h5">Pro</h3>
      <p className="small text-secondary mb-0">Up to 10 entities per school group, with plan upgrades managed by CLEAR administrators. Pricing is not yet published.</p>
     </section>
     <section className="card p-4 border-secondary"><h3 className="h5">Corporate</h3>
      <p className="small text-secondary mb-0">Institutional scale and tailored arrangements. Contact the platform administrator for eligibility and pricing.</p>
     </section>
    </aside>
   </div>
  </div>
 </main>;
}
