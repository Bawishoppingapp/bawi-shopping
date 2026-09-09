import { cookies } from "next/headers"
import { redirect, notFound } from "next/navigation"
import { Button, StatusBadge } from "@bawi/ui"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentSeller } from "@/features/auth/services/medusa-auth-client"
import {
  getFulfillmentOrder,
  FulfillmentClientError,
} from "@/features/fulfillment/services/fulfillment-client"
import {
  markPreparingAction,
  markReadyForPickupAction,
} from "@/features/fulfillment/actions/fulfillment-actions"
import { formatMoney } from "@/features/finance/utils/format-price"

export const dynamic = "force-dynamic"

/**
 * Never shows the customer's name, phone, email, or delivery address -
 * this data is never even fetched server-side for this page (see
 * apps/backend/src/fulfillment/seller-fulfillment-response.ts,
 * docs/SECURITY.md §11). Shows the pickup code once ready_for_pickup so
 * the seller can display it for the courier - never the customer's own
 * delivery-confirmation code.
 */
export default async function FulfillmentOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  const seller = await getCurrentSeller(sessionToken)
  if (!seller) {
    redirect("/login")
  }
  const currencyCode = seller.seller.currency_code

  let order
  try {
    order = await getFulfillmentOrder(sessionToken, id)
  } catch (error) {
    if (error instanceof FulfillmentClientError) {
      notFound()
    }
    throw error
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">{order.fulfillment_code}</h1>
          <p className="text-sm text-neutral-500">
            Prep deadline: {new Date(order.fulfillment_deadline_at).toLocaleString()}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <section className="rounded-md border border-neutral-200 p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-900">Items</h2>
        <ul className="flex flex-col gap-2">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between text-sm">
              <span className="text-neutral-700">
                {item.title}
                {item.color ? ` - ${item.color}` : ""}
                {item.size ? ` / ${item.size}` : ""} × {item.quantity}
              </span>
              <span className="text-neutral-500">{item.product_code}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-md border border-neutral-200 p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-900">Your earnings</h2>
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">Amount you earn</span>
          <span className="text-neutral-900">{formatMoney(order.earnings, currencyCode)}</span>
        </div>
      </section>

      {order.status === "awaiting_preparation" && (
        <form action={markPreparingAction.bind(null, order.id)}>
          <Button type="submit">Mark as preparing</Button>
        </form>
      )}

      {order.status === "preparing" && (
        <form action={markReadyForPickupAction.bind(null, order.id)}>
          <Button type="submit">Mark ready for pickup</Button>
        </form>
      )}

      {order.pickup_code && (
        <section className="rounded-md border border-blue-200 bg-blue-50 p-4">
          <h2 className="mb-1 text-sm font-medium text-blue-900">Pickup code</h2>
          <p className="text-sm text-blue-700">
            Show this code to the courier when they arrive for pickup.
          </p>
          <p className="mt-2 text-2xl font-mono font-semibold text-blue-900">
            {order.pickup_code}
          </p>
        </section>
      )}
    </main>
  )
}
