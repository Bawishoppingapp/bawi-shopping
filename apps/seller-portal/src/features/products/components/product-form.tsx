"use client"

import { useActionState } from "react"
import { Button, FormField, Input, Select, Textarea } from "@bawi/ui"
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
    category_id: string
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

      <FormField label="Category" error={state.fieldErrors.category_id}>
        <Select name="category_id" defaultValue={initialValues?.category_id ?? ""}>
          <option value="" disabled>
            Select a category
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </FormField>

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
