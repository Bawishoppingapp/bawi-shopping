"use client"

import { useActionState } from "react"
import { Button, FormField, Input } from "@bawi/ui"
import { createCourierAction } from "../actions/create"
import { initialCreateCourierFormState } from "../constants"

/**
 * No notification service exists yet, so a successful submission shows the
 * activation link directly for the admin to relay manually - same
 * documented stand-in as seller-application approval (see docs/DECISIONS.md).
 */
export function CreateCourierForm() {
  const [state, formAction, pending] = useActionState(
    createCourierAction,
    initialCreateCourierFormState
  )

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-green-200 bg-green-50 p-4">
        <p className="text-sm font-medium text-green-800">Courier created.</p>
        {state.activationUrl && (
          <p className="text-xs text-green-700">
            Activation link (share with the courier until email delivery ships):
            <br />
            <span className="break-all font-mono">{state.activationUrl}</span>
          </p>
        )}
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-md border border-neutral-200 p-4">
      <h2 className="text-sm font-medium text-neutral-900">Add a courier</h2>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Name" error={state.fieldErrors.name}>
          <Input name="name" />
        </FormField>
        <FormField label="Email" error={state.fieldErrors.email}>
          <Input name="email" type="email" />
        </FormField>
      </div>
      <FormField label="Phone (optional)">
        <Input name="phone" type="tel" />
      </FormField>
      {state.formError && (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      )}
      <Button type="submit" loading={pending} className="self-start">
        Create courier
      </Button>
    </form>
  )
}
