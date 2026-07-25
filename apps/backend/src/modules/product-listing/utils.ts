import { randomBytes } from "node:crypto"

/**
 * Product codes are permanent once issued, so they're generated from random
 * bytes rather than derived from the title (unlike a slug, which is allowed
 * to change when the title changes) - nothing about the product should be
 * able to invalidate its code.
 */
function generateCandidateCode(): string {
  return `BW-${randomBytes(4).toString("hex").toUpperCase()}`
}

export async function generateUniqueProductCode(
  isTaken: (candidate: string) => Promise<boolean>
): Promise<string> {
  let candidate = generateCandidateCode()

  while (await isTaken(candidate)) {
    candidate = generateCandidateCode()
  }

  return candidate
}
