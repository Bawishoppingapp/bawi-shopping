"use client"

import { useActionState } from "react"
import { Button, FormField, Input } from "@bawi/ui"
import { createInviteAction } from "../actions/team-actions"
import { initialCreateInviteState } from "../constants"

export function CreateInviteForm() {
  const [state, formAction, pending] = useActionState(createInviteAction, initialCreateInviteState)

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-md border border-neutral-200 p-4">
      <h2 className="text-sm font-medium text-neutral-900">Invite a teammate</h2>
      <FormField label="Email">
        <Input name="email" type="email" required />
      </FormField>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      )}
      <Button type="submit" loading={pending} className="self-start">
        Send invite
      </Button>
    </form>
  )
}
