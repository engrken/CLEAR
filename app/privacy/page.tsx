// app/privacy/page.tsx
export default function PrivacyPolicyPage() {
  return (
    <div className="container py-5 text-color" style={{ maxWidth: '800px' }}>
      <h1 className="fw-bold mb-4">Privacy Policy for CLEAR System</h1>
      <p className="text-secondary mb-4">Effective date: October 16, 2026</p>

      <p>
        The <strong>CLEAR System</strong> (Centralized Liquidation, Expense, & Audit Records) operates as a financial management and audit platform for institutional departments and student organizations. This Privacy Policy outlines how we collect, use, and protect your information when you use our web application or mobile application.
      </p>

      <h3 className="fw-bold mt-4 mb-2">1. Information We Collect</h3>
      <p>
        We collect institutional email addresses and authentication tokens (via One-Time Passwords) strictly for secure login, role-based access control, and tenant verification. Financial records, liquidation entries, and audit logs managed within your department's tenant portal are securely stored in our encrypted database.
      </p>

      <h3 className="fw-bold mt-4 mb-2">2. How We Use Your Information</h3>
      <ul>
        <li>To authenticate authorized department officers and system administrators.</li>
        <li>To maintain transparent financial ledgers, audit trails, and expense liquidations.</li>
        <li>To send secure login verification codes via email.</li>
      </ul>

      <h3 className="fw-bold mt-4 mb-2">3. Data Security</h3>
      <p>
        We implement robust security measures, including hashed OTP tokens, constant-time verification comparisons, and encrypted database connections, to ensure your institutional data remains protected.
      </p>

      <h3 className="fw-bold mt-4 mb-2">4. Contact Us</h3>
      <p>
        If you have any questions or concerns regarding this Privacy Policy, you may contact the system administrators at <strong>clearsysadmin@gmail.com</strong>.
      </p>
    </div>
  );
}