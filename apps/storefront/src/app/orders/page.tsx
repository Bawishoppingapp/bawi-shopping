import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { translate } from "@bawi/i18n"
import { getLocale } from "@bawi/i18n/server"
import { CUSTOMER_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentCustomer } from "@/features/auth/services/medusa-auth-client"
import { listOrders } from "@/features/orders/services/orders-client"

export const dynamic = "force-dynamic"

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export default async function OrdersPage() {
  const locale = await getLocale()
  const t = (key: Parameters<typeof translate>[1]) => translate(locale, key)

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value
  const customer = sessionToken ? await getCurrentCustomer(sessionToken) : null
  if (!customer) {
    redirect("/login")
  }

  const orders = await listOrders()

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold text-neutral-900">{t("order.historyTitle")}</h1>

      {orders.length === 0 ? (
        <p className="text-neutral-500">{t("order.noOrders")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li
              key={order.id}
              className="flex items-center justify-between rounded-md border border-neutral-200 p-4"
            >
              <div>
                <p className="font-medium text-neutral-900">{order.display_id}</p>
                <p className="text-sm text-neutral-500">
                  {new Date(order.created_at).toLocaleDateString(locale)}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-medium text-neutral-900">{formatUsd(order.total)}</span>
                <Link
                  href={`/orders/${order.id}`}
                  className="text-sm font-medium text-neutral-700 hover:underline"
                >
                  {t("order.viewDetails")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
