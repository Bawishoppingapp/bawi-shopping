"use client"

import { useActionState } from "react"
import { Button, Checkbox, FormField, Input, Textarea } from "@bawi/ui"
import { VariantRowsEditor } from "./variant-rows-editor"
import { initialProductFormState, type VariantRow } from "../constants"
import type { CategoryOption } from "../services/products-client"
import type { ProductFormState } from "../constants"

const CURRENCY_LABEL: Record<string, string> = { usd: "USD cents, e.g. 4999 = $49.99", etb: "ETB cents, e.g. 250000 = Br 2,500" }

export function ProductForm({
  action,
  categories,
  submitLabel,
  initialValues,
  currencyCode = "usd",
}: {
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>
  categories: CategoryOption[]
  submitLabel: string
  initialValues?: {
    title: string
    description: string
    category_ids: string[]
    base_price: string
    variants: VariantRow[]
  }
  currencyCode?: string
}) {
  const [state, formAction, pending] = useActionState(action, initialProductFormState)

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormField label="Title" error={state.fieldErrors.title}>
        <Input name="title" defaultValue={initialValues?.title} />
      </FormField>

      <FormField label="Description" error={state.fieldErrors.description}>
        <Textarea name="description" rows={4} defaultValue={initialValues?.description} />
      </FormField>
      <p className="-mt-3 text-xs leading-5 text-neutral-500">
        For an accurate AI preview, include material, exact color, pattern, fit, length, sleeves, neckline, closures, pockets, lining, stretch, care, condition, logo placement, and every included piece.
      </p>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-neutral-900">Categories</span>
        <p className="text-xs text-neutral-500">Select every category that fits this item.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categories.map((category) => (
            <label key={category.id} className="flex items-center gap-2 rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-700">
              <Checkbox name="category_ids" value={category.id} defaultChecked={initialValues?.category_ids.includes(category.id)} />
              {category.name}
            </label>
          ))}
        </div>
        {state.fieldErrors.category_ids && <p role="alert" className="text-sm text-red-600">{state.fieldErrors.category_ids}</p>}
      </div>

      <FormField
        label={`Base price (${CURRENCY_LABEL[currencyCode] ?? CURRENCY_LABEL.usd})`}
        error={state.fieldErrors.base_price}
      >
        <Input
          name="base_price"
          inputMode="numeric"
          defaultValue={initialValues?.base_price}
        />
      </FormField>

      <VariantRowsEditor
        initialVariants={initialValues?.variants}
        error={state.fieldErrors.variants}
      />

      {state.formError && (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      )}

      <Button type="submit" loading={pending} className="mt-2 self-start">
        {submitLabel}
      </Button>
    </form>
  )
}
