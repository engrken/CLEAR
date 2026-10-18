import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";

/** Preferences apply to ALL routine CLEAR transaction emails.
 * Authentication/OTP/security notices intentionally do not use this module.
 * Email addresses are normalized when saved or queried.
 */
export function normalizePreferenceEmail(value: unknown): string {
  const email = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || email.length > 254) {
    throw new Error("A valid email address is required.");
  }
  return email;
}

export type EmailPreferenceFlags = {
  receiveParticipantEmails: boolean;
  receiveOfficerCopies: boolean;
};
export const DEFAULT_TRANSACTION_EMAIL_FLAGS: EmailPreferenceFlags = {
  receiveParticipantEmails: true,
  receiveOfficerCopies: true,
};

type Tx = Prisma.TransactionClient;
export async function getTransactionEmailPreference(
  tx: Tx, organizationId: string, rawEmail: string,
): Promise<EmailPreferenceFlags> {
  const email = normalizePreferenceEmail(rawEmail);
  const stored = await tx.transactionEmailPreference.findUnique({
    where: { organizationId_email: { organizationId, email } },
    select: { receiveParticipantEmails: true, receiveOfficerCopies: true },
  });
  return stored || DEFAULT_TRANSACTION_EMAIL_FLAGS;
}

/** A recipient who wears both hats must agree to both categories to receive
 * a combined receipt. Separate addresses are evaluated separately. */
export function mayDeliverToRole(
  role: string, flags: EmailPreferenceFlags,
): boolean {
  const officer = role.includes("Processing Officer");
  const participant = !officer || role.includes(" + ");
  return (!officer || flags.receiveOfficerCopies) &&
    (!participant || flags.receiveParticipantEmails);
}

const getSecret = (): string =>
  process.env.EMAIL_PREFERENCES_SECRET || process.env.AUTH_SECRET || "";

export type SignedPreference = {
  org: string;
  email: string;
  exp: number;
};

/** Opaque 90-day token: AES-GCM hides the recipient address from URL logs.
 * Opening a link is read-only; changing preferences requires an explicit POST.
 */
export function signEmailPreferenceLink(organizationId: string, email: string): string | null {
  const secret = getSecret();
  if (secret.length < 32) return null;
  const payload: SignedPreference = {
    org: organizationId,
    email: normalizePreferenceEmail(email),
    exp: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
  };
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

export function verifyEmailPreferenceLink(token: string): SignedPreference | null {
  try {
    if (typeof token !== "string" || token.length > 2500 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
    const secret = getSecret();
    if (secret.length < 32) return null;
    const bytes = Buffer.from(token, "base64url");
    if (bytes.length < 29) return null;
    const iv = bytes.subarray(0, 12);
    const tag = bytes.subarray(12, 28);
    const ciphertext = bytes.subarray(28);
    const key = createHash("sha256").update(secret).digest();
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const payload: SignedPreference = JSON.parse(Buffer.concat([
      decipher.update(ciphertext), decipher.final(),
    ]).toString("utf8"));
    if (!payload || typeof payload.org !== "string" || payload.org.length > 256 ||
        typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now()/1000) ||
        payload.exp > Math.floor(Date.now()/1000) + 91*24*3600) return null;
    payload.email = normalizePreferenceEmail(payload.email);
    return payload;
  } catch { return null; }
}

/** Construct only from an operator-configured origin, never from request Host. */
export function emailPreferenceUrl(organizationId: string, email: string): string | null {
  const token = signEmailPreferenceLink(organizationId, email);
  if (!token) return null;
  const origin = process.env.EMAIL_PREFERENCES_BASE_URL ||
    process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && !(url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname))) return null;
    url.pathname = "/email/preferences";
    url.search = "";
    url.hash = "";
    url.searchParams.set("token", token);
    return url.toString();
  } catch { return null; }
}
