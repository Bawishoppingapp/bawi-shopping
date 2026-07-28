"use client"

import { useActionState } from "react"
import { Button } from "@bawi/ui"
import { triggerPayoutAction } from "../actions/trigger-payout"
import { initialTriggerPayoutState } from "../constants"

export function TriggerPayoutForm({
  vendorId,
  disabled,
}: {
  vendorId: string
  disabled: boolean
}) {
  const [state, formAction, pending] = useActionState(
    triggerPayoutAction.bind(null, vendorId),
    initialTriggerPayoutState
  )

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <Button type="submit" loading={pending} disabled={disabled} className="text-xs">
        Pay out
      </Button>
      {state.status !== "idle" && (
        <p
          className={`text-xs ${state.status === "error" ? "text-red-600" : "text-neutral-500"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  )
}
