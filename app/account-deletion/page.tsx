// app/account-deletion/page.tsx
//
// Public page Google Play links to as the app's account and data deletion URL.
// The admin side of each step is scripts/deletion-request.js.
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Account and Data Deletion | CLEAR System',
  description: 'How officers and students of CLEAR System ask for their account or personal data to be deleted.',
};

const CONTACT_EMAIL = 'clearsysadmin@gmail.com';
const MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('CLEAR deletion request')}&body=${encodeURIComponent(
  'Organization:\nI am an officer / a student (choose one):\nOfficer email or student ID number:\nWhat to delete (officer account, contact details, payment proof images):\n'
)}`;

export default function AccountDeletionPage() {
  return (
    <div className="container py-5 text-color" style={{ maxWidth: '800px' }}>
      <h1 className="fw-bold mb-3">Account and Data Deletion</h1>
      <p className="text-secondary mb-4">
        CLEAR System web app and CLEAR System for Android (<code>com.rupertbulquerin.clear</code>)
      </p>

      <p>
        CLEAR has no sign-up. Officer accounts are created by each department&rsquo;s or organization&rsquo;s
        administrator, and students do not have accounts. You can still ask for your account or your personal
        data to be deleted at any time, from the web or from the Android app.
      </p>

      <h3 className="fw-bold mt-4 mb-2">How to ask</h3>
      <ol>
        <li>
          Email <a href={MAILTO}><strong>{CONTACT_EMAIL}</strong></a> from the address your organization has
          on file (officers) or from your school email (students).
        </li>
        <li>
          Include the name of your department or organization, and your officer email or your student ID
          number.
        </li>
        <li>Say what you want deleted (see below).</li>
      </ol>
      <p>
        <a className="btn btn-primary" href={MAILTO}>
          <i className="bi bi-envelope me-2" aria-hidden="true"></i>Email a deletion request
        </a>
      </p>
      <p>
        We may ask your organization to confirm the request. We reply within 15 working days and tell you
        what was deleted and what was kept, and why.
      </p>

      <h3 className="fw-bold mt-4 mb-2">What can be deleted</h3>
      <div className="table-responsive">
        <table className="table table-bordered align-middle">
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">What happens</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Officer account</td>
              <td>Deactivated right away: you can no longer sign in on the web or in the app, and every app session is ended.</td>
            </tr>
            <tr>
              <td>Officer email and username</td>
              <td>Removed and replaced with a placeholder. Your name stays on the records you entered, as part of the audit trail.</td>
            </tr>
            <tr>
              <td>App sign-in sessions</td>
              <td>Ended. You can also end your own session by signing out in the app.</td>
            </tr>
            <tr>
              <td>Payment proof images (receipt screenshots or photos)</td>
              <td>Deleted once the payment has been verified or marked invalid. The payment record itself is kept.</td>
            </tr>
            <tr>
              <td>Student email address on the roster</td>
              <td>Removed by your organization&rsquo;s officers (you will no longer get emailed receipts).</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h3 className="fw-bold mt-4 mb-2">What is kept, and for how long</h3>
      <p>
        Payments, official receipt (OR) numbers, penalties, remittances and the activity log are the
        organization&rsquo;s financial books, and other students&rsquo; clearance depends on them. They are kept
        for the academic year they belong to and up to five (5) years after, for audits, and are then deleted
        or anonymized. A student&rsquo;s name and ID number stay on those records for the same period. See
        the <Link href="/privacy">privacy policy</Link> for details.
      </p>

      <h3 className="fw-bold mt-4 mb-2">For administrators</h3>
      <p>When a request arrives, the CLEAR operator:</p>
      <ol>
        <li>Checks that the request comes from the person concerned (their email on file, or confirmation from their organization).</li>
        <li>
          For an officer, runs the deletion helper: it sets the account to Inactive, clears any pending
          sign-in code and revokes all of the officer&rsquo;s mobile sessions; with the contact option it also
          replaces their email and username. An organization admin can deactivate an officer from User
          Management too; the app sessions then end on their next request.
        </li>
        <li>For payment proofs, runs the helper for that student: it deletes the images of remittances that were already verified or invalidated and leaves pending ones for review.</li>
        <li>Asks the organization to remove a student&rsquo;s email from its roster when requested.</li>
        <li>Replies to the requester with what was deleted and what was kept.</li>
      </ol>
    </div>
  );
}
