/** Conservative input screening before any question is sent to a third-party model. */
export function hasSensitiveAiIdentifiers(question: string): boolean {
  const value = question.normalize('NFKC');
  return [
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
    /(?:^|\D)(?:\+?63|0)9\d{9}(?:\D|$)/,
    /\b\d{9,16}\b/,
    /\b(?:student\s*(?:id|number)|student\s*no\.?|receipt\s*(?:id|number|no\.?|reference)|or\s*(?:number|no\.?|reference)|otp|one.time.password|password|api\s*key|access\s*token|bank\s*account)\s*[:#-]?\s*[a-z0-9_-]{4,}/i,
  ].some(pattern => pattern.test(value));
}
