"use client"

import { useActionState } from "react"
import { Button, FormField, Input } from "@bawi/ui"
import { approveReturnRequestAction, type ReturnActionState } from "../actions/finance-actions"

const initialState: ReturnActionState = { status: "idle" }

export function ApproveReturnForm({ returnRequestId }: { returnRequestId: string }) {
  const [state, formAction, pending] = useActionState(
    approveReturnRequestAction.bind(null, returnRequestId),
    initialState
  )

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border border-green-200 bg-green-50 p-4">
      <h2 className="text-sm font-medium text-green-900">Approve and refund</h2>
      <FormField label="Partial refund amount in USD (leave blank for a full refund)">
        <Input name="requested_amount" type="number" min="0" step="0.01" placeholder="Full amount" />
      </FormField>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      )}
      <Button type="submit" loading={pending} className="self-start">
        Approve return
      </Button>
    </form>
  )
}
