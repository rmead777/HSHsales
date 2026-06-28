// ─────────────────────────────────────────────────────────────────────────────
// Sale attribution — the core mechanism. Get this exactly right (spec §6).
//
// Stripe Payment Links accept `client_reference_id` ONLY as [A-Za-z0-9_-], max 200
// chars. Anything else (@ . : / spaces) or over-length is SILENTLY DROPPED by Stripe,
// so the attribution arrives `null` on the webhook with no error. Always sanitize.
// ─────────────────────────────────────────────────────────────────────────────

/** Coerce a rep_code into the charset Stripe's client_reference_id will actually keep. */
export function sanitizeRepCode(repCode: string): string {
  return repCode.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 200)
}

/**
 * Build a rep's attributed checkout URL from a product's base Payment Link.
 * Uses the URL API so an existing query string on the base link is preserved
 * (handles `?` vs `&` automatically). Throws on a malformed base URL — use the
 * `safe*` variant in UI where the admin may have pasted something invalid.
 */
export function buildAttributedPaymentLink(paymentLinkUrl: string, repCode: string): string {
  const url = new URL(paymentLinkUrl)
  url.searchParams.set('client_reference_id', sanitizeRepCode(repCode))
  return url.toString()
}

/** Top-of-funnel demo link carries the rep as `?ref={rep_code}`. */
export function buildDemoUrl(demoBaseUrl: string, repCode: string): string {
  const url = new URL(demoBaseUrl)
  url.searchParams.set('ref', sanitizeRepCode(repCode))
  return url.toString()
}

/** Non-throwing wrappers for UI: return null instead of crashing on a bad base URL. */
export function safeBuildAttributedPaymentLink(paymentLinkUrl: string, repCode: string): string | null {
  try {
    return buildAttributedPaymentLink(paymentLinkUrl, repCode)
  } catch {
    return null
  }
}

export function safeBuildDemoUrl(demoBaseUrl: string | undefined, repCode: string): string | null {
  if (!demoBaseUrl) return null
  try {
    return buildDemoUrl(demoBaseUrl, repCode)
  } catch {
    return null
  }
}
