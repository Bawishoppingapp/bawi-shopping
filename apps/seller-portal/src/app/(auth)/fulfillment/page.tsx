import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { StatusBadge } from "@bawi/ui"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import { listFulfillmentOrders } from "@/features/fulfillment/services/fulfillment-client"

export const dynamic = "force-dynamic"

export default async function FulfillmentPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  const fulfillmentOrders = await listFulfillmentOrders(sessionToken)

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold text-neutral-900">Fulfillment orders</h1>

      {fulfillmentOrders.length === 0 ? (
        <p className="text-sm text-neutral-500">No fulfillment orders yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-md border border-neutral-200">
          {fulfillmentOrders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/fulfillment/${order.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-neutral-50"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-neutral-900">
                    {order.fulfillment_code}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {order.items.length} item{order.items.length === 1 ? "" : "s"} - deadline{" "}
                    {new Date(order.fulfillment_deadline_at).toLocaleString()}
                  </span>
                </div>
                <StatusBadge status={order.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
