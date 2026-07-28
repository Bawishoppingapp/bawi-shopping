"use client"

import { useActionState } from "react"
import { Button, FormField, Select, Textarea } from "@bawi/ui"
import { useTranslations } from "@bawi/i18n"
import { createReturnRequestAction, type ReturnRequestState } from "../actions/returns-actions"

const initialState: ReturnRequestState = { status: "idle" }

export function ReturnRequestForm({
  orderId,
  vendorOrderItemId,
}: {
  orderId: string
  vendorOrderItemId: string
}) {
  const t = useTranslations()
  const [state, formAction, pending] = useActionState(
    createReturnRequestAction.bind(null, orderId, vendorOrderItemId),
    initialState
  )

  if (state.status === "success") {
    return <p className="text-sm text-green-700">{t("order.returnRequestSent")}</p>
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border border-neutral-200 p-3">
      <FormField label={t("order.returnReasonLabel")}>
        <Select name="reason" defaultValue="">
          <option value="" disabled>
            {t("order.returnReasonLabel")}
          </option>
          <option value="damaged">{t("order.returnReasonDamaged")}</option>
          <option value="defective">{t("order.returnReasonDefective")}</option>
          <option value="incorrect">{t("order.returnReasonIncorrect")}</option>
          <option value="customer_remorse">{t("order.returnReasonCustomerRemorse")}</option>
        </Select>
      </FormField>
      <FormField label={t("order.returnCommentLabel")}>
        <Textarea name="customer_comment" rows={2} />
      </FormField>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
      <Button type="submit" variant="secondary" loading={pending} className="self-start">
        {t("order.submitReturn")}
      </Button>
    </form>
  )
}
