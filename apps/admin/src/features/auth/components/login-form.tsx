"use client"

import { useActionState } from "react"
import { Button, FormField, Input } from "@bawi/ui"
import { loginAdmin } from "../actions/login"
import { initialLoginState } from "../constants"

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAdmin, initialLoginState)

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormField label="Email" error={state.fieldErrors.email}>
        <Input name="email" type="email" autoComplete="email" />
      </FormField>
      <FormField label="Password" error={state.fieldErrors.password}>
        <Input name="password" type="password" autoComplete="current-password" />
      </FormField>

      {state.formError && (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      )}

      <Button type="submit" loading={pending} className="mt-2">
        Log in
      </Button>
    </form>
  )
}
