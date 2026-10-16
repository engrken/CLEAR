// app/privacy/page.tsx
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | CLEAR System',
  description: 'How the CLEAR System web app and Android app collect, use, keep and delete personal data.',
};

const CONTACT_EMAIL = 'clearsysadmin@gmail.com';

export default function PrivacyPolicyPage() {
  return (
    <div className="container py-5 text-color" style={{ maxWidth: '800px' }}>
      <h1 className="fw-bold mb-4">Privacy Policy for CLEAR System</h1>
      <p className="text-secondary mb-4">Effective date: October 16, 2026</p>

      <p>
        The <strong>CLEAR System</strong> (Centralized Liquidation of Expenses &amp; Audit Records) is a
        finance and clearance tool used by departments and student organizations at Filamer Christian
        University. It is an independent tool, not an official service of the university. This policy
        covers the web application at <strong>clear.rupertbulquerin.com</strong> and the Android app{' '}
        <strong>CLEAR System for Android</strong> (package <code>com.rupertbulquerin.clear</code>). Both use
        the same server and the same data.
      </p>

      <h3 className="fw-bold mt-4 mb-2">1. Who is responsible</h3>
      <p>
        CLEAR is developed and operated independently by its developer (the &ldquo;operator&rdquo;). Each
        department or student organization that uses CLEAR decides which students, fees and records it keeps,
        and is the <strong>personal information controller</strong> for its own records under the Philippine
        Data Privacy Act of 2012 (Republic Act No. 10173). The operator runs the system on their behalf as a{' '}
        <strong>personal information processor</strong> and does not use the data for any other purpose.
      </p>
      <p>
        Contact for privacy questions and requests, including the data protection officer:{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}><strong>{CONTACT_EMAIL}</strong></a>.
      </p>

      <h3 className="fw-bold mt-4 mb-2">2. Information we collect</h3>
      <h5 className="fw-semibold mt-3">Officers</h5>
      <ul>
        <li>Name, email address, username, role and the parts of the system they may open, entered by the organization&rsquo;s administrator.</li>
        <li>One-time sign-in codes. We store only a hash of each code; it expires after 5 minutes and works once.</li>
        <li>For the Android app: a sign-in session record with its start, expiry and last-used time and the app&rsquo;s HTTP user agent (for example <code>okhttp/4.x</code>), so officers can see and end their sessions. This is not a device identifier.</li>
        <li>An activity log of officer actions (for example &ldquo;recorded a payment&rdquo; or &ldquo;verified a remittance&rdquo;), kept for the organization&rsquo;s audits.</li>
      </ul>
      <h5 className="fw-semibold mt-3">Students</h5>
      <ul>
        <li><strong>Roster data</strong> from the organization: student ID number, full name, year level, enrollment status and, optionally, an email address.</li>
        <li><strong>Payment records</strong>: fee items, amounts, official receipt (OR) numbers, payment dates, penalties and balances.</li>
        <li>
          <strong>Online payment proofs</strong> that a student submits: a screenshot or photo of the receipt,
          the payment channel (for example GCash, Maya or bank transfer), the reference number, the amount and
          the fee it is for. Please hide your mobile number and remaining wallet balance before uploading a
          screenshot.
        </li>
        <li>
          <strong>Clearance status</strong>. Anyone who enters a student ID number can see that student&rsquo;s
          name and whether they are cleared for the term, without the itemized payments. Clearance documents
          carry a QR signature so they can be checked.
        </li>
      </ul>
      <p>
        We do not collect card or bank account numbers: CLEAR never takes payments, it only records that a
        payment happened. We do not collect location, contacts, or advertising identifiers.
      </p>

      <h3 className="fw-bold mt-4 mb-2">3. How we use it</h3>
      <ul>
        <li>To sign in officers and limit each one to their own organization and role.</li>
        <li>To record fees, payments, penalties and remittances, and to verify submitted payment proofs.</li>
        <li>To show students their clearance status and generate clearance documents.</li>
        <li>To email sign-in codes to officers and, when the roster has a student&rsquo;s email, a digital receipt for a recorded payment.</li>
        <li>To keep audit trails and prevent fraud or misuse.</li>
      </ul>
      <p>
        We do not sell personal data, use it for advertising, or share it with anyone for their own purposes.
        The web app and the Android app have no analytics, advertising or crash-reporting tools.
      </p>

      <h3 className="fw-bold mt-4 mb-2">4. The Android app</h3>
      <ul>
        <li>The app asks for no camera, microphone, location or contacts permission. To attach a payment proof, it opens the Android photo picker, and only the image you choose is uploaded (up to 4 MB).</li>
        <li>An officer&rsquo;s sign-in token is kept in the device&rsquo;s secure storage (Android Keystore) and is excluded from device backups. A mobile session ends after 7 days, at sign-out, or as soon as the officer&rsquo;s account is deactivated.</li>
        <li>All traffic goes to our server over HTTPS.</li>
      </ul>

      <h3 className="fw-bold mt-4 mb-2">5. Service providers</h3>
      <p>These companies process data only to run CLEAR for us:</p>
      <ul>
        <li><strong>Neon</strong>: database hosting (encrypted connections).</li>
        <li>Our <strong>server hosting provider</strong> (a virtual private server that runs the web app and API).</li>
        <li><strong>Resend</strong>: delivery of sign-in codes and receipts by email.</li>
        <li><strong>Vercel Blob</strong>: storage of organization logos (no personal data).</li>
        <li><strong>jsDelivr</strong>: the web pages load their style and icon files from this public CDN, which receives your IP address like any web server.</li>
      </ul>

      <h3 className="fw-bold mt-4 mb-2">6. Cookies and local storage</h3>
      <p>
        The web app sets a sign-in cookie for officers (valid up to 6 hours) and remembers your theme and that
        you have read the privacy notice in your browser&rsquo;s local storage. There are no tracking cookies.
      </p>

      <h3 className="fw-bold mt-4 mb-2">7. How long we keep it</h3>
      <ul>
        <li>Sign-in codes: until used, or 5 minutes. Android sessions: 7 days. Sign-in attempt counters: kept only to enforce the lockout (5 wrong codes lock sign-in for 15 minutes).</li>
        <li>Financial records (payments, OR numbers, penalties, remittances and the activity log) are the organization&rsquo;s books. They are kept for the academic year they belong to and up to five (5) years after, for audits and for other students&rsquo; clearance, unless the organization asks us to delete them sooner.</li>
        <li>Payment proof images are kept with their remittance record, and are deleted on request once the remittance has been verified or marked invalid.</li>
        <li>An officer account is kept while the organization needs it; when it is deactivated, sign-in stops at once.</li>
      </ul>

      <h3 className="fw-bold mt-4 mb-2">8. Security</h3>
      <p>
        Data travels over HTTPS and is stored in an access-controlled database over encrypted connections.
        Sign-in codes and app tokens are stored only as hashes and compared in constant time; repeated wrong
        codes lock sign-in. Each officer sees only their own organization&rsquo;s data, limited by role.
      </p>

      <h3 className="fw-bold mt-4 mb-2">9. Your rights</h3>
      <p>
        Under the Data Privacy Act you have the right to be informed, to access your personal data, to have
        it corrected, to object to processing, to have it erased or blocked, to data portability, and to claim
        damages. Students can also ask their organization&rsquo;s officers directly. To use these rights, or to
        ask for deletion, follow the steps on our{' '}
        <Link href="/account-deletion">account and data deletion page</Link> or email{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We answer within 15 working days.
      </p>
      <p>
        Some records cannot be erased while the organization still needs them for its audit, because they are
        its financial books and other students&rsquo; clearance depends on them. In that case we remove the
        details that are not needed and tell you what was kept and why.
      </p>
      <p>
        If you believe your data has been mishandled, you may file a complaint with the{' '}
        <strong>National Privacy Commission</strong> (
        <a href="https://privacy.gov.ph" target="_blank" rel="noopener noreferrer">privacy.gov.ph</a>).
      </p>

      <h3 className="fw-bold mt-4 mb-2">10. Children</h3>
      <p>
        CLEAR is meant for university students and officers. It is not directed at children under 13, and we
        do not knowingly collect their data.
      </p>

      <h3 className="fw-bold mt-4 mb-2">11. Changes to this policy</h3>
      <p>
        We post any new version on this page and change the effective date above. If a change significantly
        affects how personal data is used, we tell the organizations&rsquo; administrators before it takes
        effect.
      </p>

      <h3 className="fw-bold mt-4 mb-2">12. Contact us</h3>
      <p>
        Questions or concerns about this policy:{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}><strong>{CONTACT_EMAIL}</strong></a>.
      </p>
    </div>
  );
}
