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
  return randomBytes(32).toString("hex")
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
