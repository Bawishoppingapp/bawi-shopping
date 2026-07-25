import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Button, StatusBadge } from "@bawi/ui"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import { listMyProducts } from "@/features/products/services/products-client"

// Per-seller-scoped list - must never be cached across sessions.
export const dynamic = "force-dynamic"

export default async function ProductsPage() {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  const products = await listMyProducts(sessionToken)

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-16">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Your products</h1>
        <Link href="/products/new">
          <Button>New product</Button>
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-neutral-500">
          No products yet. Create your first one to get started.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200 rounded-md border border-neutral-200">
          {products.map(({ listing, product }) => (
            <li key={listing.id}>
              <Link
                href={`/products/${listing.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-neutral-50"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-neutral-900">
                    {product?.title ?? "Untitled product"}
                  </span>
                  <span className="text-xs text-neutral-500">{listing.product_code}</span>
                </div>
                <StatusBadge status={listing.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
