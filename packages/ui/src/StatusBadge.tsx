const STYLES: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  submitted: "bg-blue-50 text-blue-700",
  under_review: "bg-amber-50 text-amber-700",
  approved: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
  withdrawn: "bg-neutral-100 text-neutral-500",
}

const LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
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
