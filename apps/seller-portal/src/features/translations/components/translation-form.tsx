"use client"

import { useActionState, useTransition } from "react"
import { Button, FormField, Input, StatusBadge, Textarea } from "@bawi/ui"
import type { ProductTranslation } from "../services/translations-client"
import { saveTranslationAction, submitTranslationAction } from "../actions/translations-actions"
import { initialTranslationFormState, LOCALE_LABELS } from "../constants"

export function TranslationForm({
  productListingId,
  locale,
  translation,
}: {
  productListingId: string
  locale: string
  translation: ProductTranslation | undefined
}) {
  const [state, formAction, pending] = useActionState(
    saveTranslationAction.bind(null, productListingId),
    initialTranslationFormState
  )
  const [submitting, startTransition] = useTransition()

  return (
    <div className="rounded-md border border-neutral-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-neutral-900">{LOCALE_LABELS[locale] ?? locale}</h3>
        {translation && <StatusBadge status={translation.status} />}
      </div>

      {translation?.status === "rejected" && translation.rejection_reason && (
        <p className="mb-3 text-xs text-red-600">Reviewer note: {translation.rejection_reason}</p>
      )}

      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="locale" value={locale} />
        <FormField label="Title">
          <Input name="title" defaultValue={translation?.title ?? ""} required />
        </FormField>
        <FormField label="Description">
          <Textarea name="description" rows={3} defaultValue={translation?.description ?? ""} />
        </FormField>
        {state.status === "error" && (
          <p role="alert" className="text-sm text-red-600">
            {state.formError}
          </p>
        )}
        <div className="flex gap-2">
          <Button type="submit" variant="secondary" loading={pending}>
            Save draft
          </Button>
          {translation && (translation.status === "draft" || translation.status === "rejected") && (
            <Button
              type="button"
              loading={submitting}
              onClick={() =>
                startTransition(() => submitTranslationAction(productListingId, locale))
              }
            >
              Submit for review
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
