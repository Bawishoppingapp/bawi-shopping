import type { ReactNode } from "react"

/** Reflows 2 columns on mobile up to 4 on desktop (docs/DESIGN-SYSTEM.md §9). */
export function ProductGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
  )
}

/** Skeleton placeholders matching the eventual grid shape, not a spinner
 * (docs/DESIGN-SYSTEM.md §7). */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <div className="aspect-[4/5] w-full animate-pulse rounded-md bg-neutral-100" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-100" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-100" />
        </div>
      ))}
    </div>
  )
}

export function ProductGridEmpty({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-md border border-dashed border-neutral-300 py-16 text-center">
      <p className="text-sm font-medium text-neutral-900">{title}</p>
      {description && <p className="text-sm text-neutral-500">{description}</p>}
    </div>
  )
}

export function ProductGridError({
  message,
  retryLabel,
  onRetry,
}: {
  message: string
  retryLabel?: string
  onRetry?: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-red-200 bg-red-50 py-16 text-center">
      <p className="text-sm font-medium text-red-700">{message}</p>
      {onRetry && retryLabel && (
        <button
          type="button"
          onClick={onRetry}
          className="text-sm font-medium text-red-700 underline underline-offset-2"
        >
          {retryLabel}
        </button>
      )}
    </div>
  )
}
