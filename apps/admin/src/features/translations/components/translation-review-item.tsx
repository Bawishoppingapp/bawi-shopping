"use client"

import { useActionState, useTransition } from "react"
import { Button, Textarea } from "@bawi/ui"
import type { PendingTranslation } from "../services/translations-client"
import { approveTranslationAction, rejectTranslationAction } from "../actions/translations-actions"
import { initialRejectTranslationState, LOCALE_LABELS } from "../constants"

export function TranslationReviewItem({ translation }: { translation: PendingTranslation }) {
  const [approving, startApprove] = useTransition()
  const [state, rejectAction, rejecting] = useActionState(
    rejectTranslationAction.bind(null, translation.id),
    initialRejectTranslationState
  )

  return (
    <li className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase text-neutral-500">
          {LOCALE_LABELS[translation.locale] ?? translation.locale}
        </span>
        <span className="text-xs text-neutral-400">Seller {translation.vendor_id}</span>
      </div>
      <p className="text-sm font-medium text-neutral-900">{translation.title}</p>
      {translation.description && (
        <p className="text-sm text-neutral-600">{translation.description}</p>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          loading={approving}
          onClick={() => startApprove(() => approveTranslationAction(translation.id))}
        >
          Approve
        </Button>
      </div>

      <form action={rejectAction} className="flex flex-col gap-2">
        <Textarea name="reason" rows={2} placeholder="Reason for rejection" />
        {state.status === "error" && (
          <p role="alert" className="text-xs text-red-600">
            {state.formError}
          </p>
        )}
        <Button type="submit" variant="destructive" loading={rejecting} className="self-start">
          Reject
        </Button>
      </form>
    </li>
  )
}
