const STYLES: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  submitted: "bg-blue-50 text-blue-700",
  pending_review: "bg-amber-50 text-amber-700",
  under_review: "bg-amber-50 text-amber-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
  withdrawn: "bg-neutral-100 text-neutral-500",
  archived: "bg-neutral-100 text-neutral-500",
  "Not connected": "bg-neutral-100 text-neutral-500",
  Pending: "bg-amber-50 text-amber-700",
  Live: "bg-green-50 text-green-700",
  awaiting_preparation: "bg-neutral-100 text-neutral-600",
  preparing: "bg-amber-50 text-amber-700",
  ready_for_pickup: "bg-blue-50 text-blue-700",
  picked_up: "bg-blue-50 text-blue-700",
  out_for_delivery: "bg-amber-50 text-amber-700",
  delivered: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-700",
  returned: "bg-neutral-100 text-neutral-500",
  requested: "bg-blue-50 text-blue-700",
  denied: "bg-red-50 text-red-700",
  refunded: "bg-green-50 text-green-700",
  paid: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
  open: "bg-amber-50 text-amber-700",
  won: "bg-green-50 text-green-700",
  lost: "bg-red-50 text-red-700",
}

const LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  pending_review: "Pending review",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  archived: "Archived",
  "Not connected": "Not connected",
  Pending: "Pending",
  Live: "Live",
  awaiting_preparation: "Awaiting preparation",
  preparing: "Preparing",
  ready_for_pickup: "Ready for pickup",
  picked_up: "Picked up",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
  requested: "Requested",
  denied: "Denied",
  refunded: "Refunded",
  paid: "Paid",
  failed: "Failed",
  open: "Open",
  won: "Won",
  lost: "Lost",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium " +
        (STYLES[status] ?? "bg-neutral-100 text-neutral-600")
      }
    >
      {LABELS[status] ?? status}
    </span>
  )
}
