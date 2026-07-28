"use client"

import { useActionState } from "react"
import { Button, Input } from "@bawi/ui"
import { confirmPickupAction } from "../actions/assignment-actions"
import { initialCodeFormState } from "../constants"

export function ConfirmPickupForm({ assignmentId }: { assignmentId: string }) {
  const [state, formAction, pending] = useActionState(
    confirmPickupAction.bind(null, assignmentId),
    initialCodeFormState
  )

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-neutral-900">
          Enter the pickup code shown by the seller
        </span>
        <Input name="code" autoCapitalize="characters" />
      </label>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      )}
      <Button type="submit" loading={pending} className="self-start">
        Confirm pickup
      </Button>
    </form>
  )
}
