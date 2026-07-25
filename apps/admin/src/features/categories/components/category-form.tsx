"use client"

import { useActionState } from "react"
import { Button, Checkbox, FormField, Input, Select } from "@bawi/ui"
import { createCategoryAction } from "../actions/create"
import { updateCategoryAction } from "../actions/update"
import { initialCategoryFormState, TRANSLATABLE_LOCALES } from "../constants"

export interface ParentOption {
  id: string
  name: string
  depth: number
}

interface CategoryFormProps {
  mode: "create" | "edit"
  categoryId?: string
  parentOptions: ParentOption[]
  initialValues?: {
    name: string
    parent_category_id: string | null
    is_active: boolean
    translations: Record<string, string>
  }
}

export function CategoryForm({ mode, categoryId, parentOptions, initialValues }: CategoryFormProps) {
  const action =
    mode === "create" ? createCategoryAction : updateCategoryAction.bind(null, categoryId!)
  const [state, formAction, pending] = useActionState(action, initialCategoryFormState)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormField label="Name" error={state.fieldErrors.name}>
        <Input name="name" defaultValue={initialValues?.name} required maxLength={200} />
      </FormField>

      <FormField label="Parent category">
        <Select name="parent_category_id" defaultValue={initialValues?.parent_category_id ?? ""}>
          <option value="">No parent (top-level)</option>
          {parentOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {"  ".repeat(option.depth)}
              {option.name}
            </option>
          ))}
        </Select>
      </FormField>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <Checkbox name="is_active" defaultChecked={initialValues?.is_active ?? true} />
        Active (visible to customers and sellers)
      </label>

      <fieldset className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4">
        <legend className="px-1 text-sm font-medium text-neutral-900">
          Translations (optional - English falls back to the name above)
        </legend>
        {TRANSLATABLE_LOCALES.map(({ code, label }) => (
          <FormField key={code} label={label}>
            <Input
              name={`translation_${code}`}
              defaultValue={initialValues?.translations[code] ?? ""}
              maxLength={200}
            />
          </FormField>
        ))}
      </fieldset>

      {state.formError && (
        <p role="alert" className="text-sm text-red-600">
          {state.formError}
        </p>
      )}

      <Button type="submit" loading={pending}>
        {mode === "create" ? "Create category" : "Save changes"}
      </Button>
    </form>
  )
}
