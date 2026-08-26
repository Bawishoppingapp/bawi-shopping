"use client"

import { useActionState } from "react"
import { Button, FormField, Input } from "@bawi/ui"
import { useTranslations } from "@bawi/i18n"
import { startCheckoutAction } from "../actions/start-checkout"
import { initialCheckoutState } from "../constants"
import { PaymentStep } from "./payment-step"

/**
 * Two steps in one component so useActionState's single form-owning
 * component naturally hands off from "collect address" to "confirm
 * payment" once the backend has returned a client_secret - no separate
 * page navigation needed between them.
 */
export function CheckoutFlow({ idempotencyKey }: { idempotencyKey: string }) {
  const [state, formAction, pending] = useActionState(startCheckoutAction, initialCheckoutState)
  const t = useTranslations()

  if (state.result?.client_secret) {
    return <PaymentStep clientSecret={state.result.client_secret} orderId={state.result.order_id} />
  }

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <div className="grid grid-cols-2 gap-4">
        <FormField label={t("checkout.firstName")} error={state.fieldErrors.firstName}>
          <Input name="firstName" autoComplete="given-name" />
        </FormField>
        <FormField label={t("checkout.lastName")} error={state.fieldErrors.lastName}>
          <Input name="lastName" autoComplete="family-name" />
        </FormField>
      </div>

      <FormField label={t("checkout.addressLine1")} error={state.fieldErrors.address1}>
        <Input name="address1" autoComplete="address-line1" />
      </FormField>
      <FormField label={t("checkout.addressLine2")}>
        <Input name="address2" autoComplete="address-line2" />
      </FormField>

      <div className="grid grid-cols-3 gap-4">
        <FormField label={t("checkout.city")} error={state.fieldErrors.city}>
          <Input name="city" autoComplete="address-level2" />
        </FormField>
        <FormField label={t("checkout.province")} error={state.fieldErrors.province}>
          <Input name="province" autoComplete="address-level1" />
        </FormField>
        <FormField label={t("checkout.postalCode")} error={state.fieldErrors.postalCode}>
          <Input name="postalCode" autoComplete="postal-code" />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label={t("checkout.country")} error={state.fieldErrors.countryCode}>
          <Input name="countryCode" autoComplete="country" defaultValue="ET" maxLength={2} />
        </FormField>
        <FormField label={t("checkout.phone")} error={state.fieldErrors.phone}>
          <Input name="phone" type="tel" autoComplete="tel" />
        </FormField>
      </div>

      {state.formError && (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      )}

      <Button type="submit" loading={pending} className="mt-2">
        {pending ? t("checkout.placingOrder") : t("checkout.continueToPayment")}
      </Button>
    </form>
  )
}
