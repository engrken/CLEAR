/* Safe, narrow insertion into current TopHeader profile modal. Preview first. */
const fs=require("node:fs"),path=require("node:path");
const file=path.join(process.cwd(),"app","department","[department]","TopHeader.tsx");
let s=fs.readFileSync(file,"utf8");
const marker='<form onSubmit={handleSaveEmail}>';
const link='<div className="px-4 pt-3"><a className="btn btn-outline-info btn-sm" href={`/department/${encodeURIComponent(department)}/email-preferences`}><i className="bi bi-envelope-check me-2"/>Transaction Email Preferences</a></div>';
if(s.includes('/email-preferences')) {console.log("Header already contains Email Preferences shortcut.");process.exit(0)}
if(!s.includes(marker)) throw new Error("Profile form anchor was not found; no files changed. Add a link manually to /department/[department]/email-preferences.");
if(!process.argv.includes('--apply')) {console.log('PREVIEW: insert a Transaction Email Preferences shortcut above the Officer Profile form. Run --apply to update.');process.exit(0)}
const backup=file+'.email-pref-backup';fs.copyFileSync(file,backup);
s=s.replace(marker,link+'\n              '+marker);
fs.writeFileSync(file,s); console.log('Updated TopHeader profile shortcut, backup: '+backup);
