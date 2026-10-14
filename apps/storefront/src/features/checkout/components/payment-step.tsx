"use client"

import Link from "next/link"
import { Button } from "@bawi/ui"
import type { CheckoutStartResult } from "../constants"

function formatEtb(amount: number) {
  return new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB" }).format(amount / 100)
}

export function PaymentStep({ result }: { result: CheckoutStartResult }) {
  if (result.status === "pending_quote") {
    return <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-5">
      <h2 className="text-xl font-semibold">Order placed — delivery quote pending</h2>
      <p className="text-sm text-neutral-600">Bawi will confirm delivery for order #{result.display_id}. Pay only after the full goods-and-delivery total appears on your order page.</p>
      <Link href={`/orders/${result.order_id}`}><Button>View order</Button></Link>
    </section>
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-5">
      <div>
        <h2 className="text-xl font-semibold">Transfer with Telebirr</h2>
        <p className="text-sm text-neutral-600">Order #{result.display_id} is pending payment approval.</p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-neutral-500">Recipient</dt><dd className="font-medium">{result.payment_recipient_name}</dd>
        <dt className="text-neutral-500">Phone</dt><dd className="font-medium">{result.payment_recipient_phone}</dd>
        <dt className="text-neutral-500">Total</dt><dd className="font-semibold">{result.total === null ? "Awaiting quote" : formatEtb(result.total)}</dd>
      </dl>
      <p className="text-sm text-neutral-600">
        Transfer the exact total, then open this order in the Bawi Shopping app to upload the Telebirr confirmation screenshot. An administrator must verify it before the order is approved.
      </p>
      <Link href="/account/orders"><Button>View my orders</Button></Link>
    </section>
  )
}
