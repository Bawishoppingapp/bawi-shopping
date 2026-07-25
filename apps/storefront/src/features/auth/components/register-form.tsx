"use client"

import { useActionState } from "react"
import { Button, FormField, Input } from "@bawi/ui"
import { useTranslations } from "@bawi/i18n"
import { registerCustomer } from "../actions/register"
import { initialRegisterState } from "../constants"

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(
    registerCustomer,
    initialRegisterState
  )
  const t = useTranslations()

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <FormField label={t("register.firstName")} error={state.fieldErrors.firstName}>
          <Input name="firstName" autoComplete="given-name" />
        </FormField>
        <FormField label={t("register.lastName")} error={state.fieldErrors.lastName}>
          <Input name="lastName" autoComplete="family-name" />
        </FormField>
      </div>
      <FormField label={t("register.email")} error={state.fieldErrors.email}>
        <Input name="email" type="email" autoComplete="email" />
      </FormField>
      <FormField label={t("register.password")} error={state.fieldErrors.password}>
        <Input name="password" type="password" autoComplete="new-password" />
      </FormField>

      {state.formError && (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      )}

      <Button type="submit" loading={pending} className="mt-2">
        {pending ? t("register.submitting") : t("register.submit")}
      </Button>
    </form>
  )
}
