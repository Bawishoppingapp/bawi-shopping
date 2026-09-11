"use client"

import Link from "next/link"
import { Button } from "@bawi/ui"
import type { CheckoutStartResult } from "../constants"

function formatEtb(amount: number) {
  return new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB" }).format(amount / 100)
}

export function PaymentStep({ result }: { result: CheckoutStartResult }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-neutral-200 p-5">
      <div>
        <h2 className="text-xl font-semibold">Transfer with Telebirr</h2>
        <p className="text-sm text-neutral-600">Order #{result.display_id} is pending payment approval.</p>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-neutral-500">Recipient</dt><dd className="font-medium">{result.payment_recipient_name}</dd>
        <dt className="text-neutral-500">Phone</dt><dd className="font-medium">{result.payment_recipient_phone}</dd>
        <dt className="text-neutral-500">Total</dt><dd className="font-semibold">{formatEtb(result.total)}</dd>
      </dl>
      <p className="text-sm text-neutral-600">
        Transfer the exact total, then open this order in the Bawi Shopping app to upload the Telebirr confirmation screenshot. An administrator must verify it before the order is approved.
      </p>
      <Link href="/account/orders"><Button>View my orders</Button></Link>
    </section>
  )
}
