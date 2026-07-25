import "server-only"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export class StripeOnboardingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "StripeOnboardingError"
  }
}

/** Seller-authenticated. Creates (or reuses) the seller's Stripe Express
 * account and returns a single-use onboarding URL to redirect to. */
export async function createOnboardingLink(sessionToken: string): Promise<string> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/seller/stripe/onboarding-link`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
  })

  if (!response.ok) {
    throw new StripeOnboardingError("Could not start Stripe onboarding")
  }

  const data = await response.json()
  return data.url as string
}
