import Link from "next/link"

const STATUSES = [
  { value: "", label: "All" },
  { value: "pending_review", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
] as const

export function StatusFilter({ activeStatus }: { activeStatus: string }) {
  return (
    <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
      {STATUSES.map((s) => {
        const isActive = s.value === activeStatus
        const href = s.value ? `/products?status=${s.value}` : "/products"
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
