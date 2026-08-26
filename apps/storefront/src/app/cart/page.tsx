import Link from "next/link"
import { translate } from "@bawi/i18n"
import { getLocale } from "@bawi/i18n/server"
import { Button } from "@bawi/ui"
import { getCart } from "@/features/cart/services/cart-client"
import { CartItemRow } from "@/features/cart/components/cart-item-row"
import { clearCartAction } from "@/features/cart/actions/clear-cart"
import { formatMoney } from "@/features/discovery/utils/format-price"

export const dynamic = "force-dynamic"

export default async function CartPage() {
  const locale = await getLocale()
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key)
  const cart = await getCart()

  if (cart.items.length === 0) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-neutral-900">{t("cart.title")}</h1>
        <p className="text-neutral-500">{t("cart.empty")}</p>
        <p className="text-sm text-neutral-400">{t("cart.emptyHint")}</p>
        <Link href="/search" className="mt-2">
          <Button variant="secondary">{t("cart.continueShopping")}</Button>
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-4 py-16 md:flex-row">
      <div className="flex-1">
        <h1 className="mb-6 text-2xl font-semibold text-neutral-900">{t("cart.title")}</h1>
        <ul>
          {cart.items.map((item) => (
            <CartItemRow key={item.id} item={item} warnings={cart.warnings} currencyCode={cart.currency_code} />
          ))}
        </ul>
        <form action={clearCartAction} className="mt-4">
          <Button type="submit" variant="secondary">
            {t("cart.clearCart")}
          </Button>
        </form>
      </div>

      <aside className="flex w-full flex-col gap-3 rounded-md border border-neutral-200 p-4 md:w-72">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">{t("cart.subtotal")}</span>
          <span className="font-medium text-neutral-900">{formatMoney(cart.subtotal, cart.currency_code)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">{t("cart.shippingEstimate")}</span>
          <span className="font-medium text-neutral-900">
            {cart.shipping_estimate === 0 ? t("cart.free") : formatMoney(cart.shipping_estimate, cart.currency_code)}
          </span>
        </div>

        {cart.qualifies_for_free_shipping ? (
          <p className="text-sm text-green-700">{t("cart.qualifiesForFreeShipping")}</p>
        ) : (
          <p className="text-sm text-neutral-500">
            {formatMoney(cart.amount_remaining_for_free_shipping, cart.currency_code)} {t("cart.freeShippingProgress")}
          </p>
        )}

        {cart.checkout_blocked && (
          <p role="alert" className="text-sm text-red-600">
            {t("cart.checkoutBlocked")}
          </p>
        )}

        {!cart.checkout_blocked && (
          <Link href="/checkout">
            <Button className="w-full">{t("checkout.title")}</Button>
          </Link>
        )}
      </aside>
    </main>
  )
}
