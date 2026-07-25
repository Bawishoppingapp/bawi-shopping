"use client"

import { useActionState, useMemo, useState } from "react"
import { useTranslations } from "@bawi/i18n"
import { Button, Select, Input } from "@bawi/ui"
import { addToCart } from "../actions/add-to-cart"
import { initialCartActionState } from "../constants"
import type { PublicProductVariant } from "@/features/products/services/products-client"

export function AddToCartForm({ variants }: { variants: PublicProductVariant[] }) {
  const [state, formAction, pending] = useActionState(addToCart, initialCartActionState)
  const t = useTranslations()

  // Derived, not stored: a fresh `state` object (different reference from
  // the initial constant) only exists once the action has actually
  // returned, so this is true exactly when the most recent submission
  // succeeded - no effect/local state needed to track it.
  const justAdded = !pending && state !== initialCartActionState && state.status === "idle"

  const colors = useMemo(() => Array.from(new Set(variants.map((v) => v.color))), [variants])
  const [selectedColor, setSelectedColor] = useState(colors[0] ?? "")

  const sizesForColor = useMemo(
    () => variants.filter((v) => v.color === selectedColor).map((v) => v.size),
    [variants, selectedColor]
  )
  const [selectedSize, setSelectedSize] = useState(sizesForColor[0] ?? "")

  const selectedVariant = variants.find(
    (v) => v.color === selectedColor && v.size === selectedSize
  )
  const isAvailable = (selectedVariant?.available_quantity ?? 0) > 0

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="variantId" value={selectedVariant?.id ?? ""} />

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">{t("cart.selectColor")}</span>
          <Select
            value={selectedColor}
            onChange={(e) => {
              const nextColor = e.target.value
              setSelectedColor(nextColor)
              const nextSizes = variants
                .filter((v) => v.color === nextColor)
                .map((v) => v.size)
              setSelectedSize(nextSizes[0] ?? "")
            }}
          >
            {colors.map((color) => (
              <option key={color} value={color}>
                {color}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">{t("cart.selectSize")}</span>
          <Select value={selectedSize} onChange={(e) => setSelectedSize(e.target.value)}>
            {sizesForColor.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <label className="flex w-24 flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-700">{t("cart.quantity")}</span>
        <Input
          name="quantity"
          type="number"
          min={1}
          max={selectedVariant?.available_quantity ?? 1}
          defaultValue={1}
        />
      </label>

      <Button type="submit" loading={pending} disabled={!isAvailable || !selectedVariant}>
        {pending
          ? t("cart.adding")
          : isAvailable
            ? t("cart.addToCart")
            : t("product.outOfStock")}
      </Button>

      {justAdded && (
        <p role="status" className="text-sm text-green-700">
          {t("cart.addedToCart")}
        </p>
      )}
      {state.status === "error" && state.formError && (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      )}
    </form>
  )
}
