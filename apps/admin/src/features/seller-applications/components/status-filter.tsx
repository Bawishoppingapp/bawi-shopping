import Link from "next/link"

const STATUSES = [
  { value: "", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
] as const

export function StatusFilter({ activeStatus }: { activeStatus: string }) {
  return (
    <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
      {STATUSES.map((s) => {
        const isActive = s.value === activeStatus
        const href = s.value ? `/applications?status=${s.value}` : "/applications"
        return (
          <Link
            key={s.value}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={
              "rounded-full px-3 py-1 text-sm font-medium transition-colors " +
              (isActive
                ? "bg-neutral-900 text-white"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200")
            }
          >
            {s.label}
          </Link>
        )
      })}
    </nav>
  )
}
