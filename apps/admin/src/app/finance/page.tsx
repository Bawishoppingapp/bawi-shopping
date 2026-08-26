import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentAdmin } from "@/features/auth/services/medusa-auth-client"
import { getFinanceOverview } from "@/features/finance/services/finance-client"
import { TriggerPayoutForm } from "@/features/finance/components/trigger-payout-form"
import { formatMoney } from "@/features/finance/utils/format-price"

export const dynamic = "force-dynamic"

export default async function FinancePage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  const admin = sessionToken ? await getCurrentAdmin(sessionToken) : null
  if (!admin || !sessionToken) {
    redirect("/login")
  }

  const overview = await getFinanceOverview(sessionToken)

  // One totals row per currency present - never blended, see
  // finance-client.ts's FinanceOverview doc comment.
  const totalsByCurrency = Object.entries(overview.platform_totals)

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-12">
      <nav className="flex gap-4 text-sm">
        <Link href="/applications" className="text-neutral-500 hover:underline">
          Applications
        </Link>
        <Link href="/products" className="text-neutral-500 hover:underline">
          Products
        </Link>
        <Link href="/categories" className="text-neutral-500 hover:underline">
          Categories
        </Link>
        <Link href="/sellers" className="text-neutral-500 hover:underline">
          Sellers
        </Link>
        <Link href="/fulfillment" className="text-neutral-500 hover:underline">
          Fulfillment
        </Link>
        <Link href="/couriers" className="text-neutral-500 hover:underline">
          Couriers
        </Link>
        <span className="font-medium text-neutral-900">Finance</span>
        <Link href="/team" className="text-neutral-500 hover:underline">
          Team
        </Link>
        <Link href="/translations" className="text-neutral-500 hover:underline">
          Translations
        </Link>
        <Link href="/config" className="text-neutral-500 hover:underline">
          Configuration
        </Link>
      </nav>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-neutral-900">Finance</h1>
        <div className="flex gap-2 text-sm">
          <Link href="/finance/returns" className="text-neutral-500 hover:underline">
            Returns
          </Link>
          <span className="text-neutral-300">·</span>
          <Link href="/finance/disputes" className="text-neutral-500 hover:underline">
            Disputes
          </Link>
        </div>
      </div>

      {totalsByCurrency.map(([currencyCode, totals]) => (
        <section key={currencyCode} className="flex flex-col gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {currencyCode} totals
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(
              [
                ["Pending", totals.pending],
                ["Available", totals.available],
                ["Paid out", totals.paid],
                ["Disputed", totals.disputed],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-md border border-neutral-200 p-4">
                <p className="text-xs text-neutral-500">{label}</p>
                <p className="mt-1 text-lg font-semibold text-neutral-900">
                  {formatMoney(value, currencyCode)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ))}

      {overview.sellers.length === 0 ? (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
          No seller balances yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Seller</th>
                <th className="px-4 py-2 font-medium">Currency</th>
                <th className="px-4 py-2 font-medium">Pending</th>
                <th className="px-4 py-2 font-medium">Available</th>
                <th className="px-4 py-2 font-medium">Paid</th>
                <th className="px-4 py-2 font-medium">Disputed</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {overview.sellers.map((row) => (
                <tr key={row.vendor_id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-neutral-900">
                    {row.vendor_name ?? row.vendor_id}
                  </td>
                  <td className="px-4 py-3 text-neutral-500 uppercase">{row.currency_code}</td>
                  <td className="px-4 py-3 text-neutral-700">
                    {formatMoney(row.balance.pending, row.currency_code)}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {formatMoney(row.balance.available, row.currency_code)}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {formatMoney(row.balance.paid, row.currency_code)}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {formatMoney(row.balance.disputed, row.currency_code)}
                  </td>
                  <td className="px-4 py-3">
                    <TriggerPayoutForm
                      vendorId={row.vendor_id}
                      disabled={!row.payouts_enabled || row.balance.available <= 0}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
