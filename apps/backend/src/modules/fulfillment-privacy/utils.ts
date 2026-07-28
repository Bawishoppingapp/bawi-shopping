import crypto from "node:crypto"

// Excludes visually ambiguous characters - a courier reads this off a
// screen/QR fallback text and types it, same reasoning as
// src/orders/fulfillment-code.ts's alphabet.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

/** Unguessable pickup/tracking code - same non-sequential-id principle as
 * order ids (see docs/SECURITY.md §5). */
export function generatePrivacyCode(): string {
  const bytes = crypto.randomBytes(10)
  let code = ""
  for (let i = 0; i < 10; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return `${code.slice(0, 5)}-${code.slice(5)}`
}

// Defense-in-depth TTL - single-use redemption (via FulfillmentCodeRedemption)
// is what actually enforces "expire on collection", not this window; this
// just bounds how long an unused code stays valid at all (see
// docs/SECURITY.md §11).
export const PRIVACY_CODE_TTL_MS = 72 * 60 * 60 * 1000 // 72 hours
