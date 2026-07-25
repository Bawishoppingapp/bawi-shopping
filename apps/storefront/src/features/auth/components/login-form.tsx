"use client"

import { useActionState } from "react"
import Link from "next/link"
import { Button, FormField, Input } from "@bawi/ui"
import { useTranslations } from "@bawi/i18n"
import { loginCustomerAction } from "../actions/login"
import { initialLoginState } from "../constants"

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginCustomerAction, initialLoginState)
  const t = useTranslations()

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormField label={t("login.email")} error={state.fieldErrors.email}>
        <Input name="email" type="email" autoComplete="email" />
      </FormField>
      <FormField label={t("login.password")} error={state.fieldErrors.password}>
        <Input name="password" type="password" autoComplete="current-password" />
      </FormField>

      {state.formError && (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      )}

      <Button type="submit" loading={pending} className="mt-2">
        {pending ? t("login.submitting") : t("login.submit")}
      </Button>

      <p className="text-center text-sm text-neutral-500">
        {t("login.noAccount")}{" "}
        <Link href="/register" className="font-medium text-neutral-900 hover:underline">
          {t("login.createAccount")}
        </Link>
      </p>
    </form>
  )
}
