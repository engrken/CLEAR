# CLEAR Production database identity verification (temporary, disabled by default)

This route is **not active on the currently deployed Production web app**.
It must first be reviewed and merged/deployed. It does not change or rotate
`DATABASE_URL` and performs **no data mutations**.

Expected Neon Production endpoint ID (confirmed by Neon endpoint listing):
`ep-dry-wildflower-b35od340`, on branch `br-calm-dew-b3vd1ira`.
Pooled connections with `-pooler` suffix are supported. A match to this
endpoint plus a successful query to the migrated `GlobalMobileSession` table
confirms that the runtime connection targets the approved Production endpoint.

## Controlled execution

1. Independently review the diagnostic and its limited use. Deploy the
   reviewed backend commit to Vercel Production, with all normal release gates.
2. In **Vercel Production** environment variables, create a *new* random
   `CLEAR_PRODUCTION_DB_VERIFY_TOKEN` (at least 32 random characters) and set
   `CLEAR_PRODUCTION_DB_VERIFY_ENABLED=true`. **Do not touch or rotate
   `DATABASE_URL`**. These must be Production-scoped and active in a
   deployment. Do not post the token in GitHub or chat.
3. Invoke `GET https://clearsys.vercel.app/api/internal/db-identity?endpoint=ep-dry-wildflower-b35od340`
   with `Authorization: Bearer <verification token>` from an authorized client.
   The route otherwise returns 404. Never put the token in a URL.
4. Interpret: 200 `verified` + `schemaReady:true` = runtime endpoint
   and schema confirmed; 409 = wrong database endpoint, **STOP**; 503 =
   database unavailable, **STOP**. Never interpret a Vercel deployment badge
   alone as database identity proof.
5. Immediately disable `CLEAR_PRODUCTION_DB_VERIFY_ENABLED`, remove the
   temporary token, redeploy to apply env changes, and delete this route in
   a subsequent cleanup PR. Never retain a permanently enabled diagnostic.

The route compares only the endpoint ID, never returns hostnames, connection
strings, account IDs, student records, counts, or financial data. Its DB query
is read-only. A separate internal QA APK build must still pass all code review,
Vercel deployment SHA and role/access safety gates.
