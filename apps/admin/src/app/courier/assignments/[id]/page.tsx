import { cookies } from "next/headers"
import { redirect, notFound } from "next/navigation"
import { Button, StatusBadge } from "@bawi/ui"
import { COURIER_SESSION_COOKIE } from "@/features/courier-portal/constants"
import { getCurrentCourier } from "@/features/courier-portal/services/courier-auth-client"
import {
  getAssignment,
  AssignmentsClientError,
} from "@/features/courier-portal/services/assignments-client"
import { startDeliveryAction } from "@/features/courier-portal/actions/assignment-actions"
import { ConfirmPickupForm } from "@/features/courier-portal/components/confirm-pickup-form"
import { ConfirmDeliveryForm } from "@/features/courier-portal/components/confirm-delivery-form"

export const dynamic = "force-dynamic"

/**
 * Never shows the customer's name/phone/address or the seller's real
 * identity - this data is never even fetched for this page (see
 * apps/backend/src/fulfillment/courier-assignment-response.ts). Reading
 * this detail is itself audit-logged server-side on every load.
 */
export default async function CourierAssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(COURIER_SESSION_COOKIE)?.value

  const courier = sessionToken ? await getCurrentCourier(sessionToken) : null
  if (!courier || !sessionToken) {
    redirect("/courier/login")
  }

  let assignment
  try {
    assignment = await getAssignment(sessionToken, id)
  } catch (error) {
    if (error instanceof AssignmentsClientError) {
      notFound()
    }
    throw error
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-4 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">{assignment.fulfillment_code}</h1>
        <StatusBadge status={assignment.status} />
      </div>

      <section className="rounded-md border border-neutral-200 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-900">Pickup location</h2>
        <p className="text-sm text-neutral-700">{assignment.pickup_location.name}</p>
        {assignment.pickup_location.address_1 && (
          <p className="text-sm text-neutral-500">
            {assignment.pickup_location.address_1}, {assignment.pickup_location.city}
          </p>
        )}
      </section>

      <section className="rounded-md border border-neutral-200 p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-900">Items to pick up</h2>
        <ul className="flex flex-col gap-1">
          {assignment.items.map((item, index) => (
            <li key={index} className="text-sm text-neutral-700">
              {item.title}
              {item.color ? ` - ${item.color}` : ""}
              {item.size ? ` / ${item.size}` : ""} × {item.quantity}
            </li>
          ))}
        </ul>
      </section>

      {assignment.status === "ready_for_pickup" && <ConfirmPickupForm assignmentId={assignment.id} />}

      {assignment.status === "picked_up" && (
        <form action={startDeliveryAction.bind(null, assignment.id)}>
          <Button type="submit">Start delivery</Button>
        </form>
      )}

      {assignment.status === "out_for_delivery" && (
        <ConfirmDeliveryForm assignmentId={assignment.id} />
      )}

      {assignment.status === "delivered" && (
        <p className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          Delivered - thank you.
        </p>
      )}
    </main>
  )
}
