/** Public proof submission rules, independent of any UI or mobile client. */
export const PUBLIC_PAYMENT_CHANNELS = ["GCash", "Maya", "Bank Transfer"] as const;

/** Only canonical payment channels accepted by the web clearance form. */
export function normalizePublicPaymentChannel(value: unknown): string | null {
  const key = String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
  if (key === "gcash") return "GCash";
  if (key === "maya" || key === "paymaya") return "Maya";
  if (key === "bank transfer") return "Bank Transfer";
  return null;
}

/**
 * Resolve the connecting IP reported by our configured trusted ingress.
 *
 * The final X-Forwarded-For element is the last proxy-added hop, rather than a
 * client-controlled first element. This requires the deployed reverse proxy
 * to append or overwrite XFF. If behind a different/untrusted proxy, enforce
 * the trust boundary in infrastructure before relying on this rate limit.
 */
export function ingressClientIp(
  headers: Pick<Headers, "get">,
): string {
  const chain = String(headers.get("x-forwarded-for") || "");
  const fromForwarded = chain.split(",").map(part => part.trim()).filter(Boolean).at(-1);
  const ip = fromForwarded || String(headers.get("x-real-ip") || "").trim() || "unknown";
  return ip.slice(0, 64);
}
