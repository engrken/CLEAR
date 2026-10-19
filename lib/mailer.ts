import 'server-only';
import { validateOutgoingEmail, validateSender, type OutgoingEmail } from '@/lib/mail-safety';

/**
 * CLEAR's single email boundary for officer OTP, global admin OTP and receipts.
 * Requires a verified Resend domain; never put this key in client-side code.
 */
export async function sendEmail(email: OutgoingEmail): Promise<{ messageId: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured; email was not sent.');

  const from = validateSender(process.env.RESEND_FROM_EMAIL);
  const safe = validateOutgoingEmail(email);
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [safe.to],
      subject: safe.subject,
      html: safe.html,
      ...(safe.text === undefined ? {} : { text: safe.text }),
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    // Avoid logging the response body: it can include PII/email content.
    throw new Error('Email provider rejected message (HTTP ' + response.status + ').');
  }
  const receipt: unknown = await response.json();
  if (typeof receipt !== 'object' || receipt === null ||
      !('id' in receipt) || typeof receipt.id !== 'string' || !receipt.id) {
    throw new Error('Email provider returned an invalid delivery acknowledgement.');
  }
  return { messageId: receipt.id };
}
