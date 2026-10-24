// Guard tenant lifecycle writes to isolated Preview OR explicitly authorized Production.
// This second independent check is required even if the shared API allowlist permits a request.
import 'server-only';
import { ApiFailure } from '@/lib/mobile/http';

export function requireAndroidProvisioningPreview() {
  const preview = process.env.VERCEL_ENV === 'preview' &&
    process.env.VERCEL_GIT_COMMIT_REF === 'android-parity-integration';
  const authorizedProduction = process.env.VERCEL_ENV === 'production' &&
    process.env.VERCEL_GIT_COMMIT_REF === 'main' &&
    process.env.MOBILE_TENANT_OPERATIONS_ENABLED === 'true';
  if (!preview && !authorizedProduction) {
    throw new ApiFailure(403, 'forbidden', 'Android tenant changes require explicit Production authorization or isolated Preview access.');
  }
}

const ALLOWED_STARTS = [
  'Invalid ', 'Entity name ', 'Entity type ', 'Subdomain ', 'School group ',
  'Academic year ', 'Choose an academic ', 'A valid administrator ',
  'Administrator name ', 'Administrator username ', 'The system Super Admin ',
  'This subdomain ', 'An entity or administrator ', 'Another provisioning ',
  'Organization not found', 'School group ', 'Target group ',
  'A transferred entity ', 'The organization ', 'Invalid organization ',
];

export function asProvisioningApiFailure(err: unknown): never {
  if (err instanceof ApiFailure) throw err;
  const message = err instanceof Error ? err.message : '';
  if (ALLOWED_STARTS.some(prefix => message.startsWith(prefix)) ||
      /^(?:Subdomain|School group) '\S+'/.test(message)) {
    const conflict = /already|in use|Another provisioning|exceeding|inconsistent|uses the/.test(message);
    throw new ApiFailure(conflict ? 409 : 400, conflict ? 'conflict' : 'invalid', message);
  }
  // Generic response for unexpected SQL/runtime errors. The outer handler logs
  // details server-side; we never expose internal database errors to the APK.
  throw err;
}
