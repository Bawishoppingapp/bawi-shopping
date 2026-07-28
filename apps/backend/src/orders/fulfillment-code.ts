import crypto from "node:crypto"

// Excludes visually ambiguous characters (0/O, 1/I/L) - this code is
// read/typed by a seller in their dashboard, not just displayed.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"

/**
 * A per-vendor-order reference code, unguessable like every other id in
 * this system (same non-sequential-id principle as order ids - see
 * docs/DATABASE.md), but short enough to print on neutral Bawi packaging
 * and read aloud. Distinct from the pickup QR/tracking codes planned for
 * the private-fulfillment batch (see docs/DATABASE.md "planned" tables) -
 * this one has no expiration or replay protection, it's just a stable
 * label for "which vendor order is this."
 */
export function generateFulfillmentCode(): string {
  const bytes = crypto.randomBytes(8)
  let code = ""
  for (let i = 0; i < 8; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return `FC-${code.slice(0, 4)}-${code.slice(4)}`
}
