/** Pure, testable constraints for CLEAR system OTP and receipt emails. */
export type OutgoingEmail = { to: string; subject: string; html: string; text?: string };

// Only one unambiguous ASCII mailbox. Do not accept RFC 5322 groups,
// comments, display names, commas, or multiple addresses from user records.
const mailboxPattern = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

export function validateMailbox(value: unknown): string {
  if (typeof value !== 'string' || /[\r\n\x00-\x1f\x7f]/.test(value)) {
    throw new Error('A single email address is required.');
  }
  const email = value.trim();
  const at = email.indexOf('@');
  if (!email || email.length > 254 || at < 1 || at > 64 ||
      email.includes('..') || !mailboxPattern.test(email) ||
      email.split('@')[1].split('.').some(label => label.startsWith('-') || label.endsWith('-'))) {
    throw new Error('An unambiguous email address is required.');
  }
  return email;
}

export function validateSender(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 320 ||
      /[\r\n\x00-\x1f\x7f]/.test(value)) {
    throw new Error('Configure a verified RESEND_FROM_EMAIL sender.');
  }
  const raw = value.trim();
  const match = /^([^<>]+)\s+<([^<>]+)>$/.exec(raw);
  const mailbox = validateMailbox(match ? match[2] : raw);
  if (match && match[1].trim().length > 80) {
    throw new Error('Email sender display name is too long.');
  }
  return match ? match[1].trim() + ' <' + mailbox + '>' : mailbox;
}

export function validateOutgoingEmail(input: OutgoingEmail): OutgoingEmail {
  const to = validateMailbox(input.to);
  if (typeof input.subject !== 'string' || !input.subject.trim() ||
      input.subject.length > 200 || /[\r\n\x00-\x1f\x7f]/.test(input.subject)) {
    throw new Error('Invalid outgoing email subject.');
  }
  if (typeof input.html !== 'string' || !input.html.trim() || input.html.length > 1_048_576) {
    throw new Error('Invalid outgoing email HTML.');
  }
  if (input.text !== undefined && (typeof input.text !== 'string' || input.text.length > 1_048_576)) {
    throw new Error('Invalid outgoing email text.');
  }
  return { to, subject: input.subject, html: input.html, ...(input.text === undefined ? {} : { text: input.text }) };
}
