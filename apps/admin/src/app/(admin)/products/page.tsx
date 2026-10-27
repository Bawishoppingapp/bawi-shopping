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
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-[#B8863B]">Catalog review</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Products</h1>
          <p className="mt-2 text-sm text-neutral-500">Check listings, imagery, and details before they appear in the store.</p>
        </div>
        <div className="rounded-xl border border-[#E3DCD1] bg-white px-5 py-3 text-right">
          <span className="block text-2xl font-semibold text-[#312B26]">{listings.length}</span>
          <span className="text-xs text-neutral-500">products in view</span>
        </div>
      </header>

      <StatusFilter activeStatus={status} />

      {listings.length === 0 ? (
        <div className="rounded-xl border border-[#E3DCD1] bg-white px-6 py-16 text-center">
          <p className="font-medium text-[#312B26]">No products here yet</p>
          <p className="mt-1 text-sm text-neutral-500">Try another status to see more products.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border border-neutral-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-neutral-500">
              <tr>
                <th className="px-4 py-2 font-medium">Product</th>
                <th className="px-4 py-2 font-medium">Code</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {listings.map(({ listing, product }) => (
                <tr key={listing.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex min-w-48 items-center gap-3">
                      {product?.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.thumbnail} alt="" className="h-12 w-10 rounded-md border border-neutral-100 object-cover" />
                      ) : <span className="h-12 w-10 rounded-md bg-[#EFE9E0]" aria-hidden="true" />}
                      <Link href={`/products/${listing.id}`} className="font-semibold text-[#312B26] underline-offset-2 hover:underline">{product?.title ?? "Untitled product"}</Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{listing.product_code}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={listing.status} />
                  </td>
                  <td className="px-4 py-3 text-right"><Link href={`/products/${listing.id}`} aria-label={`Review ${product?.title ?? "product"}`} className="text-sm font-semibold text-[#B8863B] hover:underline">Review →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
