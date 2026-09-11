import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { StatusBadge } from "@bawi/ui"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentSeller } from "@/features/auth/services/medusa-auth-client"
import { getBalance, listPayouts } from "@/features/finance/services/finance-client"
import { formatMoney } from "@/features/finance/utils/format-price"

export const dynamic = "force-dynamic"

export default async function FinancePage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  const seller = await getCurrentSeller(sessionToken)
  if (!seller) {
    redirect("/login")
  }
  const currencyCode = seller.seller.currency_code

  const [balance, payouts] = await Promise.all([
    getBalance(sessionToken),
    listPayouts(sessionToken),
  ])

  const buckets: Array<{ label: string; value: number; hint?: string }> = [
    { label: "Pending", value: balance.pending, hint: "Not yet past the transfer hold period" },
    { label: "Available", value: balance.available, hint: "Ready for your next payout" },
    { label: "Paid out", value: balance.paid },
    { label: "Under review", value: balance.disputed, hint: "Frozen while a payment issue is reviewed" },
  ]

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold text-neutral-900">Finance</h1>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {buckets.map((bucket) => (
          <div key={bucket.label} className="rounded-md border border-neutral-200 p-4">
            <p className="text-xs text-neutral-500">{bucket.label}</p>
            <p className="mt-1 text-lg font-semibold text-neutral-900">
              {formatMoney(bucket.value, currencyCode)}
            </p>
            {bucket.hint && <p className="mt-1 text-xs text-neutral-400">{bucket.hint}</p>}
          </div>
        ))}
      </section>

      <section className="rounded-md border border-neutral-200 p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-900">Payout history</h2>
        {payouts.length === 0 ? (
          <p className="text-sm text-neutral-500">No payouts yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-neutral-200">
            {payouts.map((payout) => (
              <li key={payout.id} className="flex items-center justify-between py-3 text-sm">
                <div>
                  <p className="text-neutral-900">{formatMoney(payout.amount, currencyCode)}</p>
                  <p className="text-xs text-neutral-500">
                    {new Date(payout.created_at).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={payout.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
