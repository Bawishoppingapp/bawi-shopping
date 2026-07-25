import { describe, expect, test, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { StripeConnectBanner } from "../components/stripe-connect-banner"

vi.mock("../actions/start-onboarding", () => ({
  startStripeOnboardingAction: vi.fn(),
}))

describe("StripeConnectBanner", () => {
  test("shows 'not connected' and a Connect payouts button when the seller has no Stripe account yet", () => {
    render(
      <StripeConnectBanner
        stripe={{
          connected: false,
          charges_enabled: false,
          payouts_enabled: false,
          details_submitted: false,
        }}
      />
    )
    expect(screen.getByText("Payouts not connected")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Connect payouts" })).toBeInTheDocument()
  })

  test("shows 'pending' and a Finish connecting button when connected but not fully enabled", () => {
    render(
      <StripeConnectBanner
        stripe={{
          connected: true,
          charges_enabled: false,
          payouts_enabled: false,
          details_submitted: true,
        }}
      />
    )
    expect(screen.getByText("Payouts: pending Stripe setup")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Finish connecting payouts" })).toBeInTheDocument()
  })

  test("shows 'live' and no action button once charges and payouts are both enabled", () => {
    render(
      <StripeConnectBanner
        stripe={{
          connected: true,
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
        }}
      />
    )
    expect(screen.getByText("Payouts: live")).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })
})
