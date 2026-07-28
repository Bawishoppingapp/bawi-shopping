"use client"

import { useActionState } from "react"
import { Button, Select } from "@bawi/ui"
import { assignCourierAction, initialAssignCourierFormState } from "../actions/assign-courier"
import type { CourierSummary } from "@/features/couriers/services/couriers-client"

export function AssignCourierForm({
  fulfillmentOrderId,
  couriers,
}: {
  fulfillmentOrderId: string
  couriers: CourierSummary[]
}) {
  const [state, formAction, pending] = useActionState(
    assignCourierAction.bind(null, fulfillmentOrderId),
    initialAssignCourierFormState
  )
  const activeCouriers = couriers.filter((courier) => courier.status === "active")

  if (!activeCouriers.length) {
    return <p className="text-xs text-neutral-500">No active couriers available</p>
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <Select name="courier_id" defaultValue={activeCouriers[0].id}>
        {activeCouriers.map((courier) => (
          <option key={courier.id} value={courier.id}>
            {courier.name}
          </option>
        ))}
      </Select>
      <Button type="submit" loading={pending} variant="secondary">
        Assign
      </Button>
      {state.status === "error" && (
        <p role="alert" className="text-xs text-red-600">
          {state.formError}
        </p>
      )}
    </form>
  )
}
