export interface StripeOnboardingState {
  status: "idle" | "error"
  formError?: string
}

export const initialStripeOnboardingState: StripeOnboardingState = {
  status: "idle",
}
