import { randomBytes } from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

/** Appends a short random suffix until `isTaken` reports the slug is free. */
export async function generateUniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>
): Promise<string> {
  const root = slugify(base) || "seller"
  let candidate = root

  while (await isTaken(candidate)) {
    candidate = `${root}-${randomBytes(3).toString("hex")}`
  }

  return candidate
}

export function generateActivationToken(): string {
  // 12 base-32 characters carry 60 bits of entropy while remaining easy to
  // transcribe from an email. Avoid I/O and 0/1 lookalikes.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  return Array.from(randomBytes(12), (byte) => alphabet[byte & 31]).join("")
}

export function normalizeActivationToken(input: string): string {
  const compact = input.trim().replace(/[\s-]/g, "")
  // Existing 64-character hex links remain valid until they expire.
  return /^[A-HJ-NP-Z2-9]{12}$/i.test(compact) ? compact.toUpperCase() : compact
}

export function formatActivationToken(token: string): string {
  return token.length === 12 ? token.replace(/(.{4})(?=.)/g, "$1-") : token
}

export const ACTIVATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function buildSellerActivationLink(token: string): string {
  const portalUrl = process.env.SELLER_PORTAL_URL ?? "http://localhost:3001"
  const link = new URL("/activate", portalUrl)
  if (!["https:", "http:"].includes(link.protocol)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "SELLER_PORTAL_URL must use HTTP or HTTPS")
  }
  link.searchParams.set("token", token)
  return link.toString()
}
