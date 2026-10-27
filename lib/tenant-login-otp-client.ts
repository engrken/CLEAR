'use client';

/** Request ONLY an authentication challenge through the READ_ONLY-safe endpoint.
 * The server retains all OTP eligibility, cooldown, rate and expiry protections.
 */
export async function requestTenantLoginOtp(department: string, email: string):
  Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    '/api/department/' + encodeURIComponent(department.trim().toLowerCase()) + '/auth/request-code',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    },
  );
  const body = await response.json().catch(() => null);
  if (!body || typeof body.success !== 'boolean') {
    throw new Error(response.status === 503
      ? 'Authentication is temporarily unavailable during maintenance.'
      : 'The authentication service returned an invalid response.');
  }
  if (!response.ok || !body.success) {
    throw new Error(typeof body.message === 'string' && body.message
      ? body.message : 'Unable to request a verification code.');
  }
  return { success: true, message: String(body.message || 'Verification code requested.') };
}
