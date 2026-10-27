"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Button, FormField, Input } from "@bawi/ui"
import { activateSellerAccount } from "../actions/activate"
import { initialActivationState } from "../constants"

export function ActivationForm({ token, existingAccount }: { token: string; existingAccount: boolean }) {
  const [state, formAction, pending] = useActionState(
    activateSellerAccount,
    initialActivationState
  )

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-700">
          Your storefront is ready. Sign in with your Bawi account password.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Go to login
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="existingAccount" value={String(existingAccount)} />
      <FormField label={existingAccount ? "Existing Bawi password" : "Create password"} error={state.fieldErrors.password}>
        <Input name="password" type="password" autoComplete={existingAccount ? "current-password" : "new-password"} />
      </FormField>
      {!existingAccount && (
        <FormField label="Confirm password" error={state.fieldErrors.confirmPassword}>
          <Input name="confirmPassword" type="password" autoComplete="new-password" />
        </FormField>
      )}

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
