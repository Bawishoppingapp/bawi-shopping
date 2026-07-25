"use client"

import { useActionState } from "react"
import { Button } from "@bawi/ui"
import { startStripeOnboardingAction } from "../actions/start-onboarding"
import { initialStripeOnboardingState } from "../constants"

export interface StripeStatus {
  connected: boolean
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
}

function statusLabel(stripe: StripeStatus): { text: string; tone: string } {
  if (!stripe.connected) {
    return { text: "Payouts not connected", tone: "text-neutral-600" }
  }
  if (stripe.charges_enabled && stripe.payouts_enabled) {
    return { text: "Payouts: live", tone: "text-green-700" }
  }
  return { text: "Payouts: pending Stripe setup", tone: "text-amber-700" }
}

export function StripeConnectBanner({ stripe }: { stripe: StripeStatus }) {
  const [state, formAction, pending] = useActionState(
    startStripeOnboardingAction,
    initialStripeOnboardingState
  )
  const { text, tone } = statusLabel(stripe)
  const isLive = stripe.connected && stripe.charges_enabled && stripe.payouts_enabled

  return (
    <div className="flex flex-col gap-2 rounded-md border border-neutral-200 p-4">
      <p className={`text-sm font-medium ${tone}`}>{text}</p>
      {!isLive && (
        <form action={formAction}>
          <Button type="submit" variant="primary" loading={pending}>
            {stripe.connected ? "Finish connecting payouts" : "Connect payouts"}
          </Button>
        </form>
      )}
      {state.formError && (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      )}
    </div>
  )
}
