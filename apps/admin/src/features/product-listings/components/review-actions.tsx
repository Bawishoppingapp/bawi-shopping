"use client"

import { useActionState, useState } from "react"
import { Button, Textarea } from "@bawi/ui"
import { approveProduct } from "../actions/approve"
import { rejectProduct } from "../actions/reject"
import { initialReviewActionState } from "../constants"

interface ReviewActionsProps {
  listingId: string
  /** The listing's status as of the last full page load. */
  initialStatus: string
}

export function ReviewActions({ listingId, initialStatus }: ReviewActionsProps) {
  const [showRejectForm, setShowRejectForm] = useState(false)

  const [approveState, approveFormAction, approvePending] = useActionState(
    approveProduct.bind(null, listingId),
    initialReviewActionState
  )
  const [rejectState, rejectFormAction, rejectPending] = useActionState(
    rejectProduct.bind(null, listingId),
    initialReviewActionState
  )

  if (approveState.status === "success") {
    return (
      <p className="rounded-md border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
        Product approved and published to the storefront.
      </p>
    )
  }

  if (rejectState.status === "success") {
    return (
      <p className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm font-medium text-neutral-700">
        Product rejected.
      </p>
    )
  }

  if (initialStatus !== "pending_review") {
    return null
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <form action={approveFormAction}>
          <Button type="submit" loading={approvePending} disabled={showRejectForm}>
            Approve
          </Button>
        </form>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setShowRejectForm((v) => !v)}
          disabled={approvePending}
        >
          Reject
        </Button>
      </div>

      {approveState.formError && (
        <p role="alert" className="text-sm text-red-600">
          {approveState.formError}
        </p>
      )}

      {showRejectForm && (
        <form
          action={rejectFormAction}
          className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4"
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-neutral-900">
              Reason for rejection (kept private, never shown to the customer)
            </span>
            <Textarea name="reason" required />
          </label>
          {rejectState.formError && (
            <p role="alert" className="text-sm text-red-600">
              {rejectState.formError}
            </p>
          )}
          <Button type="submit" variant="destructive" loading={rejectPending}>
            Confirm rejection
          </Button>
        </form>
      )}
    </div>
  )
}
