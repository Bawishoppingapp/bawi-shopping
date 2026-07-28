import { randomUUID } from "node:crypto"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { translate } from "@bawi/i18n"
import { getLocale } from "@bawi/i18n/server"
import { CUSTOMER_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentCustomer } from "@/features/auth/services/medusa-auth-client"
import { getCart } from "@/features/cart/services/cart-client"
import { CheckoutFlow } from "@/features/checkout/components/checkout-flow"

export const dynamic = "force-dynamic"

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * No guest checkout in v1 (order.customer_id is NOT NULL by design - see
 * docs/DATABASE.md), same auth-required pattern as the account page. The
 * idempotency key is minted once here, server-side, per page load - see
 * checkout-flow.tsx.
 */
export default async function CheckoutPage() {
  const locale = await getLocale()
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key)

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value
  const customer = sessionToken ? await getCurrentCustomer(sessionToken) : null
  if (!customer) {
    redirect("/login")
  }

  const cart = await getCart()
  if (cart.items.length === 0) {
    redirect("/cart")
  }

  const idempotencyKey = randomUUID()

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-4 py-16 md:flex-row">
      <div className="flex-1">
        <h1 className="mb-6 text-2xl font-semibold text-neutral-900">{t("checkout.title")}</h1>
        <h2 className="mb-3 text-lg font-medium text-neutral-900">
          {t("checkout.shippingAddress")}
        </h2>
        <CheckoutFlow idempotencyKey={idempotencyKey} />
      </div>

      <aside className="flex w-full flex-col gap-3 rounded-md border border-neutral-200 p-4 md:w-72">
        <h2 className="text-lg font-medium text-neutral-900">{t("checkout.orderSummary")}</h2>
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">{t("checkout.subtotal")}</span>
          <span className="font-medium text-neutral-900">{formatUsd(cart.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">{t("checkout.shipping")}</span>
          <span className="font-medium text-neutral-900">
            {cart.shipping_estimate === 0 ? t("cart.free") : formatUsd(cart.shipping_estimate)}
          </span>
        </div>
      </aside>
    </main>
  )
}
