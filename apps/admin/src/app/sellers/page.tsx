import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { StatusBadge } from "@bawi/ui"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentAdmin } from "@/features/auth/services/medusa-auth-client"
import { listSellers, stripeStatusLabel } from "@/features/sellers/services/sellers-client"

export const dynamic = "force-dynamic"

export default async function SellersPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  const admin = sessionToken ? await getCurrentAdmin(sessionToken) : null
  if (!admin || !sessionToken) {
    redirect("/login")
  }

  const sellers = await listSellers(sessionToken)
  const notLiveCount = sellers.filter(
    (s) => s.status === "approved" && stripeStatusLabel(s.stripe) !== "Live"
  ).length

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
        <span className="font-medium text-neutral-900">Sellers</span>
        <Link href="/fulfillment" className="text-neutral-500 hover:underline">
          Fulfillment
        </Link>
        <Link href="/couriers" className="text-neutral-500 hover:underline">
          Couriers
        </Link>
        <Link href="/finance" className="text-neutral-500 hover:underline">
          Finance
        </Link>
        <Link href="/config" className="text-neutral-500 hover:underline">
          Configuration
        </Link>
      </nav>

      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-neutral-900">Sellers</h1>
        <p className="text-sm text-neutral-500">
          {sellers.length} total
          {notLiveCount > 0 &&
            ` · ${notLiveCount} approved but not yet live for Stripe payouts`}
        </p>
      </div>

      {sellers.length === 0 ? (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
          No sellers yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Seller</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Stripe</th>
                <th className="px-4 py-2 font-medium">Public brand display</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((seller) => (
                <tr key={seller.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900">{seller.name}</p>
                    <p className="text-xs text-neutral-500">{seller.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={seller.status} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={stripeStatusLabel(seller.stripe)} />
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {seller.public_brand_display_approved ? "Approved" : "Hidden"}
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
