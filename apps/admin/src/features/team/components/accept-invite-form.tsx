"use client"

import { useActionState } from "react"
import { Button, FormField, Input } from "@bawi/ui"
import { acceptInviteAction } from "../actions/accept-invite"
import { initialAcceptInviteState } from "../constants"

export function AcceptInviteForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    acceptInviteAction.bind(null, token),
    initialAcceptInviteState
  )

  if (state.status === "success") {
    return (
      <p className="text-sm text-green-700">
        Your account is ready. You can now log in.
      </p>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField label="First name">
          <Input name="first_name" required />
        </FormField>
        <FormField label="Last name">
          <Input name="last_name" required />
        </FormField>
      </div>
      <FormField label="Email">
        <Input name="email" type="email" required />
      </FormField>
      <FormField label="Password">
        <Input name="password" type="password" minLength={8} required />
      </FormField>
      {state.status === "error" && (
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
