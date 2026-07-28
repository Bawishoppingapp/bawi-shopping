"use client"

import { useActionState } from "react"
import { Button, FormField, Textarea } from "@bawi/ui"
import { denyReturnRequestAction, type ReturnActionState } from "../actions/finance-actions"

const initialState: ReturnActionState = { status: "idle" }

export function DenyReturnForm({ returnRequestId }: { returnRequestId: string }) {
  const [state, formAction, pending] = useActionState(
    denyReturnRequestAction.bind(null, returnRequestId),
    initialState
  )

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-4">
      <h2 className="text-sm font-medium text-red-900">Deny this return</h2>
      <FormField label="Reason (shown to you only, not the customer)">
        <Textarea name="seller_response" rows={3} />
      </FormField>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      )}
      <Button type="submit" variant="destructive" loading={pending} className="self-start">
        Deny return
      </Button>
    </form>
  )
}
