# Android missing-email roster parity — preparation for next signed build

This read-only, tenant-scoped mobile filter implements the same email-remediation
view introduced in web PR #92 (#47/#64). Staff with `tab-students` can
switch to a server-filtered list of students without registered email. Officers
with only `tab-payment` can continue viewing the general roster, but cannot
query this specialized remediation filter. The server checks permissions on
EVERY request, filters by organization, and returns no more than 500 matching
records; larger result sets fail with an explicit 422 rather than showing a
misleading partial list. Database projections avoid extra sensitive fields.

No student can use school-ID-only lookup to bypass OTP. No native roster edits
or financial operations are enabled; authorized staff independently verify
identity and use the existing secure web Edit Student workflow.

This is merged as source for the *next* signed Android release. The published
1.2.2 binary remains unchanged; Google Play/internal-device QA, versionCode
increment, official upload signature and current Play target SDK requirements
must be verified in a separate release gate, along with native Receipt/Void
search from #65. No new Play build should be issued for this isolated change.
