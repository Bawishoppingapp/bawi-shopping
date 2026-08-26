// Mirrors apps/seller-portal/src/features/stripe/services/stripe-client.ts's
// createOnboardingLink exactly - same POST /seller/stripe/onboarding-link
// call, same response shape ({ url }). The web app does a hard
// server-side redirect to that url; mobile opens it in an in-app browser
// (expo-web-browser) instead, since there's no server-rendered redirect
// concept here. Status afterward is read from useSellerAuth().refresh(),
// not from the return_url/refresh_url query params the backend hardcodes
// to the web seller-portal's own dashboard - those are cosmetic for a web
// browser and irrelevant to a mobile in-app browser session.
const MEDUSA_BACKEND_URL = process.env.EXPO_PUBLIC_MEDUSA_BACKEND_URL ?? "http://localhost:9000";

export class StripeOnboardingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeOnboardingError";
  }
}

export async function createOnboardingLink(sessionToken: string): Promise<string> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/seller/stripe/onboarding-link`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  if (!response.ok) {
    throw new StripeOnboardingError("Could not start Stripe onboarding. Please try again.");
  }
  const data = await response.json();
  return data.url as string;
}
