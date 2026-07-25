import Link from "next/link"
import { cookies } from "next/headers"
import { redirect, notFound } from "next/navigation"
import { StatusBadge } from "@bawi/ui"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { getCurrentAdmin } from "@/features/auth/services/medusa-auth-client"
import {
  getProductListing,
  ProductListingsError,
} from "@/features/product-listings/services/product-listings-client"
import { ReviewActions } from "@/features/product-listings/components/review-actions"

// Session-scoped (admin-authenticated) content must never be cached by the
// browser keyed only on the URL.
export const dynamic = "force-dynamic"

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  const admin = sessionToken ? await getCurrentAdmin(sessionToken) : null
  if (!admin || !sessionToken) {
    redirect("/login")
  }

  let data
  try {
    data = await getProductListing(sessionToken, id)
  } catch (error) {
    if (error instanceof ProductListingsError) {
      notFound()
    }
    throw error
  }

  const { listing, product, seller } = data

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-12">
      <Link href="/products" className="text-sm text-neutral-600 underline">
        Back to products
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">{product.title}</h1>
        <StatusBadge status={listing.status} />
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <dt className="text-neutral-500">Product code</dt>
        <dd className="text-neutral-900">{listing.product_code}</dd>
        <dt className="text-neutral-500">Seller</dt>
        <dd className="text-neutral-900">{seller.name}</dd>
        <dt className="text-neutral-500">Category</dt>
        <dd className="text-neutral-900">
          {product.categories.map((c) => c.name).join(", ") || "—"}
        </dd>
      </dl>

      <p className="text-sm text-neutral-700">{product.description}</p>

      {product.images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {product.images.map((image) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={image.id}
              src={image.url}
              alt={product.title}
              className="h-24 w-20 rounded object-cover"
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-medium text-neutral-900">Variants</h2>
        <ul className="text-sm text-neutral-600">
          {product.variants.map((variant) => (
            <li key={variant.id}>{variant.title}</li>
          ))}
        </ul>
      </div>

      {listing.status === "rejected" && listing.rejection_reason && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">Rejection reason (private)</p>
          <p>{listing.rejection_reason}</p>
        </div>
      )}

      <ReviewActions listingId={listing.id} initialStatus={listing.status} />
    </main>
  )
}
