"use client"

import { useActionState } from "react"
import { useTranslations } from "@bawi/i18n"
import { Button, Input } from "@bawi/ui"
import { updateQuantity } from "../actions/update-quantity"
import { removeItem } from "../actions/remove-item"
import { initialCartActionState, type CartItem, type CartWarning } from "../constants"

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function CartItemRow({
  item,
  warnings,
}: {
  item: CartItem
  warnings: CartWarning[]
}) {
  const [state, formAction, pending] = useActionState(updateQuantity, initialCartActionState)
  const t = useTranslations()

  const itemWarnings = warnings.filter((w) => w.line_item_id === item.id)

  return (
    <li className="flex flex-col gap-3 border-b border-neutral-200 py-4 sm:flex-row sm:items-start">
      <div className="h-24 w-20 flex-shrink-0 overflow-hidden rounded-md bg-neutral-100">
        {item.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover" />
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <p className="font-medium text-neutral-900">{item.title}</p>
        {item.brand && <p className="text-sm text-neutral-500">{item.brand}</p>}
        <p className="text-sm text-neutral-500">
          {[item.color, item.size].filter(Boolean).join(" / ")}
        </p>
        {item.product_code && (
          <p className="text-xs text-neutral-400">{item.product_code}</p>
        )}

        {itemWarnings.map((warning) => (
          <p
            key={warning.code}
            role="alert"
            className={
              warning.code === "price_changed"
                ? "text-sm text-amber-600"
                : "text-sm text-red-600"
            }
          >
            {warning.code === "unavailable" && t("cart.itemUnavailable")}
            {warning.code === "quantity_exceeds_inventory" && t("cart.quantityExceedsInventory")}
            {warning.code === "price_changed" && t("cart.priceChanged")}
          </p>
        ))}

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {item.is_available ? (
            <form action={formAction} className="flex items-center gap-2">
              <input type="hidden" name="lineItemId" value={item.id} />
              <label htmlFor={`quantity-${item.id}`} className="sr-only">
                {t("cart.quantity")}
              </label>
              <Input
                id={`quantity-${item.id}`}
                name="quantity"
                type="number"
                min={1}
                max={Math.min(item.available_quantity, item.max_quantity)}
                defaultValue={item.quantity}
                className="w-16"
              />
              <Button
                type="submit"
                variant="secondary"
                loading={pending}
                aria-label={`${t("cart.update")} - ${item.title}`}
              >
                {t("cart.update")}
              </Button>
            </form>
          ) : (
            <span className="text-sm text-neutral-500">
              {t("cart.quantity")}: {item.quantity}
            </span>
          )}

          <form action={removeItem.bind(null, item.id)}>
            <Button
              type="submit"
              variant="destructive"
              aria-label={`${t("cart.remove")} - ${item.title}`}
            >
              {t("cart.remove")}
            </Button>
          </form>
        </div>

        {state.status === "error" && state.formError && (
          <p role="alert" className="text-sm text-red-600">
            {state.formError}
          </p>
        )}
      </div>

      <div className="text-right font-medium text-neutral-900">
        {formatUsd(item.line_total)}
      </div>
    </li>
  )
}
