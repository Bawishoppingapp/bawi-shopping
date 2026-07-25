import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { StatusBadge } from "@bawi/ui"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentAdmin } from "@/features/auth/services/medusa-auth-client"
import { listProductListings } from "@/features/product-listings/services/product-listings-client"
import { StatusFilter } from "@/features/product-listings/components/status-filter"

// Session-scoped (admin-authenticated) content must never be cached by the
// browser keyed only on the URL.
export const dynamic = "force-dynamic"

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status = "" } = await searchParams
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  const admin = sessionToken ? await getCurrentAdmin(sessionToken) : null
  if (!admin || !sessionToken) {
    redirect("/login")
  }

  const { listings } = await listProductListings(sessionToken, status || undefined)

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-12">
      <nav className="flex gap-4 text-sm">
        <Link href="/applications" className="text-neutral-500 hover:underline">
          Applications
        </Link>
        <span className="font-medium text-neutral-900">Products</span>
        <Link href="/categories" className="text-neutral-500 hover:underline">
          Categories
        </Link>
      </nav>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-neutral-900">Products</h1>
        <p className="text-sm text-neutral-500">{listings.length} total</p>
      </div>

      <StatusFilter activeStatus={status} />

      {listings.length === 0 ? (
        <p className="rounded-md border border-neutral-200 bg-neutral-50 p-8 text-center text-sm text-neutral-500">
          No products match this filter.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {listings.map(({ listing, product }) => (
                <tr key={listing.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link
                      href={`/products/${listing.id}`}
                      className="font-medium text-neutral-900 underline-offset-2 hover:underline"
                    >
                      {product?.title ?? "Untitled product"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{listing.product_code}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={listing.status} />
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
