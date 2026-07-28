"use client"

import { useActionState } from "react"
import { Button, FormField, Input, Select } from "@bawi/ui"
import { inviteStaffAction } from "../actions/staff-actions"
import { initialInviteStaffState } from "../constants"

export function InviteStaffForm() {
  const [state, formAction, pending] = useActionState(inviteStaffAction, initialInviteStaffState)

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-md border border-neutral-200 p-4">
      <h2 className="text-sm font-medium text-neutral-900">Invite a team member</h2>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Email">
          <Input name="email" type="email" required />
        </FormField>
        <FormField label="Role">
          <Select name="role" defaultValue="catalog_manager">
            <option value="catalog_manager">Catalog manager</option>
            <option value="order_fulfiller">Order fulfiller</option>
            <option value="analyst">Analyst</option>
          </Select>
        </FormField>
      </div>
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
