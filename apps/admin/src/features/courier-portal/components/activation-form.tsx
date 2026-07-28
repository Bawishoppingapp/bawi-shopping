"use client"

import { useActionState } from "react"
import { Button, FormField, Input } from "@bawi/ui"
import { activateCourierAction } from "../actions/activate"
import { initialActivationState } from "../constants"

export function CourierActivationForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(activateCourierAction, initialActivationState)

  if (state.status === "success") {
    return (
      <p className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        Account activated. You can now log in.
      </p>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <FormField label="Choose a password">
        <Input name="password" type="password" autoComplete="new-password" />
      </FormField>
      {state.formError && (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      )}
      <Button type="submit" loading={pending}>
        Activate account
      </Button>
    </form>
  )
}
