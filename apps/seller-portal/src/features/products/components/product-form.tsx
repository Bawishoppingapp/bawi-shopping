"use client"

import { useActionState } from "react"
import { Button, FormField, Input, Select, Textarea } from "@bawi/ui"
import { VariantRowsEditor } from "./variant-rows-editor"
import { initialProductFormState, type VariantRow } from "../constants"
import type { CategoryOption } from "../services/products-client"
import type { ProductFormState } from "../constants"

export function ProductForm({
  action,
  categories,
  submitLabel,
  initialValues,
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

      <FormField label="Base price (USD cents, e.g. 4999 = $49.99)" error={state.fieldErrors.base_price}>
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
