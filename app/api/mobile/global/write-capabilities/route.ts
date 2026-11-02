// Global Administrator independently verified through canonical OTP bearer.
// Never infer tenant write authorization from client-side build flags.
import {handler,preflight} from '@/lib/mobile/http';
import {requireGlobalMobileAdmin} from '@/lib/mobile/global-session';
import {canRunMobileGlobalTenantOperations} from '@/lib/mobile/production-readonly';
export const GET=handler(async req=>{
 await requireGlobalMobileAdmin(req);
 return {tenantOperationsEnabled:canRunMobileGlobalTenantOperations({
   vercelEnv:process.env.VERCEL_ENV,gitRef:process.env.VERCEL_GIT_COMMIT_REF,
   tenantOperationsEnabled:process.env.MOBILE_TENANT_OPERATIONS_ENABLED==='true',
 })};
});
export const OPTIONS=preflight;
