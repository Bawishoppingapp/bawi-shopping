import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { StatusBadge } from "@bawi/ui"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentAdmin } from "@/features/auth/services/medusa-auth-client"
import { listFulfillmentOrders } from "@/features/fulfillment/services/fulfillment-client"
import { listCouriers } from "@/features/couriers/services/couriers-client"
import { AssignCourierForm } from "@/features/fulfillment/components/assign-courier-form"

export const dynamic = "force-dynamic"

/**
 * Admin-wide fulfillment view - unlike the seller's own scoped dashboard,
 * this shows vendor_id (Admin is permitted full visibility, see
 * docs/USER-ROLES.md), used here only to decide/perform courier
 * assignment for orders that are ready_for_pickup and unassigned.
 */
export default async function FulfillmentPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  const admin = sessionToken ? await getCurrentAdmin(sessionToken) : null
  if (!admin || !sessionToken) {
    redirect("/login")
  }

  const [fulfillmentOrders, couriers] = await Promise.all([
    listFulfillmentOrders(sessionToken),
    listCouriers(sessionToken),
  ])

  const needsAssignment = fulfillmentOrders.filter(
    (order) => order.status === "ready_for_pickup" && !order.assigned_courier_id
  )
  const inProgress = fulfillmentOrders.filter(
    (order) => order.assigned_courier_id && order.status !== "delivered"
  )

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-12">
      <nav className="flex flex-wrap gap-4 text-sm">
        <Link href="/applications" className="text-neutral-500 hover:underline">
          Applications
        </Link>
        <Link href="/products" className="text-neutral-500 hover:underline">
          Products
        </Link>
        <Link href="/categories" className="text-neutral-500 hover:underline">
          Categories
        </Link>
        <Link href="/sellers" className="text-neutral-500 hover:underline">
          Sellers
        </Link>
        <span className="font-medium text-neutral-900">Fulfillment</span>
        <Link href="/couriers" className="text-neutral-500 hover:underline">
          Couriers
        </Link>
        <Link href="/finance" className="text-neutral-500 hover:underline">
          Finance
        </Link>
        <Link href="/team" className="text-neutral-500 hover:underline">
          Team
        </Link>
        <Link href="/config" className="text-neutral-500 hover:underline">
          Configuration
        </Link>
      </nav>

      <h1 className="text-2xl font-semibold text-neutral-900">Fulfillment</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-900">
          Needs courier assignment ({needsAssignment.length})
        </h2>
        {needsAssignment.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing waiting on assignment.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-200 rounded-md border border-neutral-200">
            {needsAssignment.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-neutral-900">
                    {order.fulfillment_code}
                  </span>
                  <span className="text-xs text-neutral-500">
                    Deadline {new Date(order.fulfillment_deadline_at).toLocaleString()}
                  </span>
                </div>
                <AssignCourierForm fulfillmentOrderId={order.id} couriers={couriers} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-neutral-900">
          In progress ({inProgress.length})
        </h2>
        {inProgress.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing currently in progress.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-200 rounded-md border border-neutral-200">
            {inProgress.map((order) => (
              <li key={order.id} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-medium text-neutral-900">
                  {order.fulfillment_code}
                </span>
                <StatusBadge status={order.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
