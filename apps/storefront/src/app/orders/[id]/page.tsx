import Link from "next/link"
import { cookies } from "next/headers"
import { redirect, notFound } from "next/navigation"
import { translate } from "@bawi/i18n"
import { getLocale } from "@bawi/i18n/server"
import { Button, StatusBadge } from "@bawi/ui"
import { CUSTOMER_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentCustomer } from "@/features/auth/services/medusa-auth-client"
import { getOrder } from "@/features/orders/services/orders-client"
import { CancelOrderButton } from "@/features/returns/components/cancel-order-button"
import { ReturnRequestForm } from "@/features/returns/components/return-request-form"

export const dynamic = "force-dynamic"

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

/**
 * Doubles as both the order-confirmation page (right after checkout) and
 * the order-detail page reached from order history - same data, same
 * ownership check. Never shows the seller's real name/id, only the
 * resolved public brand already applied server-side (see
 * src/orders/order-response.ts) - and never a private SKU or internal
 * vendor identifier.
 */
export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const locale = await getLocale()
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key)

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value
  const customer = sessionToken ? await getCurrentCustomer(sessionToken) : null
  if (!customer) {
    redirect("/login")
  }

  const order = await getOrder(id)
  if (!order) {
    notFound()
  }

  const isConfirmation = order.status === "paid"

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-16">
      {isConfirmation && (
        <div className="rounded-md bg-green-50 p-4 text-center">
          <h1 className="text-2xl font-semibold text-green-900">
            {t("order.confirmationTitle")}
          </h1>
          <p className="text-green-700">{t("order.confirmationThankYou")}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-neutral-500">{t("order.number")}</p>
          <p className="text-lg font-medium text-neutral-900">{order.display_id}</p>
        </div>
        <p className="text-sm text-neutral-500">
          {t("order.placedOn")} {new Date(order.created_at).toLocaleDateString(locale)}
        </p>
      </div>

      {order.vendor_orders.map((vendorOrder) => (
        <section key={vendorOrder.id} className="rounded-md border border-neutral-200 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-neutral-500">
              {t("order.soldBy")} {vendorOrder.brand}
            </p>
            <StatusBadge status={vendorOrder.status} />
          </div>
          <ul className="flex flex-col gap-3">
            {vendorOrder.items.map((item) => (
              <li key={item.id} className="flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-700">
                    {item.title}
                    {item.color ? ` - ${item.color}` : ""}
                    {item.size ? ` / ${item.size}` : ""} × {item.quantity}
                  </span>
                  <span className="font-medium text-neutral-900">
                    {formatUsd(item.line_total)}
                  </span>
                </div>
                {vendorOrder.status === "delivered" && (
                  <details>
                    <summary className="cursor-pointer text-xs text-neutral-500 hover:underline">
                      {t("order.requestReturn")}
                    </summary>
                    <div className="mt-2">
                      <ReturnRequestForm orderId={order.id} vendorOrderItemId={item.id} />
                    </div>
                  </details>
                )}
              </li>
            ))}
          </ul>

          {vendorOrder.status === "awaiting_preparation" && (
            <div className="mt-4">
              <p className="mb-2 text-xs text-neutral-500">{t("order.cancelHint")}</p>
              <CancelOrderButton orderId={order.id} vendorOrderId={vendorOrder.id} />
            </div>
          )}

          {vendorOrder.delivery_confirmation_code && (
            <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs font-medium text-blue-900">{t("order.deliveryCode")}</p>
              <p className="text-xs text-blue-700">{t("order.deliveryCodeHint")}</p>
              <p className="mt-1 font-mono text-lg font-semibold text-blue-900">
                {vendorOrder.delivery_confirmation_code}
              </p>
            </div>
          )}
        </section>
      ))}

      <aside className="flex flex-col gap-2 rounded-md border border-neutral-200 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">{t("checkout.subtotal")}</span>
          <span className="font-medium text-neutral-900">{formatUsd(order.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">{t("checkout.shipping")}</span>
          <span className="font-medium text-neutral-900">{formatUsd(order.shipping)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-neutral-500">{t("checkout.tax")}</span>
          <span className="font-medium text-neutral-900">{formatUsd(order.tax)}</span>
        </div>
        <div className="flex justify-between border-t border-neutral-200 pt-2 text-sm font-semibold">
          <span className="text-neutral-900">{t("checkout.total")}</span>
          <span className="text-neutral-900">{formatUsd(order.total)}</span>
        </div>
      </aside>

      <div className="flex justify-between">
        <Link href="/orders">
          <Button variant="secondary">{t("order.viewOrders")}</Button>
        </Link>
        <Link href="/search">
          <Button variant="secondary">{t("order.continueShopping")}</Button>
        </Link>
      </div>
    </main>
  )
}
