"use client"

import { useActionState, useState } from "react"
import { Button, Textarea } from "@bawi/ui"
import { approveApplication } from "../actions/approve"
import { rejectApplication } from "../actions/reject"
import { initialReviewActionState } from "../constants"

interface ReviewActionsProps {
  applicationId: string
  /** The application's status as of the last full page load. */
  initialStatus: string
}

/**
 * Always rendered by the parent regardless of status (see
 * docs/DECISIONS.md) - submitting either form causes Next.js to refresh the
 * parent Server Component's data, which would otherwise change
 * `initialStatus` and could be mistaken for a reason to stop rendering this
 * component. Instead, this component owns the "did I just approve/reject"
 * decision via its own action state, which survives that refresh because
 * the component itself is never unmounted.
 */
export function ReviewActions({ applicationId, initialStatus }: ReviewActionsProps) {
  const [showRejectForm, setShowRejectForm] = useState(false)

  const [approveState, approveFormAction, approvePending] = useActionState(
    approveApplication.bind(null, applicationId),
    initialReviewActionState
  )
  const [rejectState, rejectFormAction, rejectPending] = useActionState(
    rejectApplication.bind(null, applicationId),
    initialReviewActionState
  )

  if (approveState.status === "success") {
    return (
      <div className="flex flex-col gap-2 rounded-md border border-green-200 bg-green-50 p-4">
        <p className="text-sm font-medium text-green-800">Application approved.</p>
        {approveState.activationLink && (
          <p className="text-xs text-green-700">
            Activation link (share with the seller until email delivery ships):
            <br />
            <span className="break-all font-mono">{approveState.activationLink}</span>
          </p>
        )}
      </div>
    )
  }

  if (rejectState.status === "success") {
    return (
      <p className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm font-medium text-neutral-700">
        Application rejected.
      </p>
    )
  }

  const isPending = initialStatus === "submitted" || initialStatus === "under_review"
  if (!isPending) {
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
        <form action={rejectFormAction} className="flex flex-col gap-3 rounded-md border border-neutral-200 p-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-neutral-900">
              Reason for rejection (kept private, never shown to the applicant)
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
