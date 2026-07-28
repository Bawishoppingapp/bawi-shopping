import Link from "next/link"
import { translate } from "@bawi/i18n"
import { getLocale } from "@bawi/i18n/server"
import { getCart } from "../services/cart-client"

/**
 * Reads the cart cookie itself, so this is the only part of the header
 * that needs per-request rendering - wrap it in <Suspense> from a static
 * layout (see layout.tsx) rather than forcing the whole site dynamic.
 */
export async function CartIcon() {
  const locale = await getLocale()
  const cart = await getCart()

  return (
    <Link
      href="/cart"
      aria-label={`${translate(locale, "cart.viewCart")} (${cart.item_count})`}
      // Extra padding widens the tappable area to the WCAG-recommended
      // ~44x44px minimum touch target without visually enlarging the
      // icon itself; the negative margin cancels it out for surrounding
      // header spacing.
      className="relative -m-3 flex items-center p-3 text-neutral-700 hover:text-neutral-900"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        className="h-5 w-5"
        aria-hidden="true"
      >
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      {cart.item_count > 0 && (
        <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-neutral-900 px-1 text-[10px] font-medium text-white">
          {cart.item_count}
        </span>
      )}
    </Link>
  )
}

export function CartIconSkeleton() {
  return <div className="h-5 w-5 animate-pulse rounded-full bg-neutral-200" aria-hidden="true" />
}
