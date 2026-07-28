"use client"

import { useActionState } from "react"
import { Button } from "@bawi/ui"
import { useTranslations } from "@bawi/i18n"
import { cancelOrderAction, type CancelOrderState } from "../actions/returns-actions"

const initialState: CancelOrderState = { status: "idle" }

export function CancelOrderButton({
  orderId,
  vendorOrderId,
}: {
  orderId: string
  vendorOrderId: string
}) {
  const t = useTranslations()
  const [state, formAction, pending] = useActionState(
    cancelOrderAction.bind(null, orderId, vendorOrderId),
    initialState
  )

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <Button type="submit" variant="destructive" loading={pending}>
        {t("order.cancelOrder")}
      </Button>
      {state.status === "error" && (
        <p role="alert" className="text-xs text-red-600">
          {state.message}
        </p>
      )}
    </form>
  )
}
