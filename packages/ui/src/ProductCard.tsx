export interface ProductCardProps {
  href: string
  imageUrl: string | null
  title: string
  brand: string
  priceLabel: string
  soldOut?: boolean
  soldOutLabel?: string
}

/**
 * Fixed 4:5 portrait ratio (docs/DESIGN-SYSTEM.md §5) so grids never look
 * jagged regardless of what a seller uploaded - the image itself, not just
 * its container, is cropped to this ratio via object-cover.
 */
export function ProductCard({
  href,
  imageUrl,
  title,
  brand,
  priceLabel,
  soldOut = false,
  soldOutLabel = "Sold out",
}: ProductCardProps) {
  return (
    <a href={href} className="group flex flex-col gap-2">
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-md bg-neutral-100">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          // Neutral placeholder graphic, never repeated title text or a
          // broken-image icon (docs/DESIGN-SYSTEM.md §5).
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center text-neutral-300"
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}
        {soldOut && (
          <span className="absolute left-2 top-2 inline-flex items-center rounded-full bg-neutral-900/80 px-2.5 py-0.5 text-xs font-medium text-white">
            {soldOutLabel}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <p className="text-xs text-neutral-500">{brand}</p>
        <p className="truncate text-sm font-medium text-neutral-900">{title}</p>
        <p className="text-sm text-neutral-900">{priceLabel}</p>
      </div>
    </a>
  )
}
