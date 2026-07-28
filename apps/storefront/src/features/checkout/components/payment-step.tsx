"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"
import { Button } from "@bawi/ui"
import { useTranslations } from "@bawi/i18n"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "")

function PaymentElementForm({ orderId }: { orderId: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const router = useRouter()
  const t = useTranslations()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!stripe || !elements) {
      return
    }
    setSubmitting(true)
    setError(null)

    // Card data is entered directly into Stripe's own iframe (Payment
    // Element) and confirmed client-side - it never touches this app's
    // frontend or backend code, only a PaymentIntent id/status does (see
    // docs/PAYMENTS.md §1).
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/orders/${orderId}` },
      redirect: "if_required",
    })

    if (confirmError) {
      setError(confirmError.message ?? t("checkout.paymentError"))
      setSubmitting(false)
      return
    }

    router.push(`/orders/${orderId}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PaymentElement />
      <Button type="submit" loading={submitting} disabled={!stripe}>
        {submitting ? t("checkout.placingOrder") : t("checkout.placeOrder")}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  )
}

export function PaymentStep({ clientSecret, orderId }: { clientSecret: string; orderId: string }) {
  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <PaymentElementForm orderId={orderId} />
    </Elements>
  )
}
