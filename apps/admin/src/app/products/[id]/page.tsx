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
import { updateAiPreviewAction } from "@/features/product-listings/actions/ai-preview"

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

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 p-4">
        <div><h2 className="font-medium text-neutral-900">AI model preview</h2><p className="text-sm text-neutral-500">Generate from the seller originals, preserving the exact garment. The original gallery remains visible as the factual product record.</p></div>
        <p className="text-sm">Status: <strong>{listing.ai_preview_status.replaceAll("_", " ")}</strong></p>
        {listing.ai_preview_url ? <div className="flex items-start gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={listing.ai_preview_url} alt="AI-generated model preview" className="h-56 w-40 rounded object-cover"/>
          <span className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-900">AI-generated preview</span>
        </div> : null}
        <form action={updateAiPreviewAction.bind(null, listing.id)} className="flex flex-col gap-2 sm:flex-row" encType="multipart/form-data"><input type="hidden" name="action" value="upload"/><input required type="file" name="file" accept="image/jpeg,image/png,image/webp" className="flex-1 rounded border p-2 text-sm"/><button className="rounded bg-neutral-950 px-4 py-2 text-sm text-white">Upload generated preview</button></form>
        {listing.ai_preview_url && listing.ai_preview_status !== "approved" ? <div className="flex flex-col gap-2 sm:flex-row"><form action={updateAiPreviewAction.bind(null, listing.id)}><input type="hidden" name="action" value="approve"/><button className="rounded bg-emerald-700 px-4 py-2 text-sm text-white">Approve preview</button></form><form action={updateAiPreviewAction.bind(null, listing.id)} className="flex flex-1 gap-2"><input type="hidden" name="action" value="reject"/><input required minLength={3} name="reason" placeholder="Why this preview is inaccurate" className="flex-1 rounded border px-3 py-2 text-sm"/><button className="rounded border border-red-300 px-4 py-2 text-sm text-red-700">Reject preview</button></form></div> : null}
        {listing.ai_preview_rejection_reason ? <p className="rounded bg-red-50 p-3 text-sm text-red-800">{listing.ai_preview_rejection_reason}</p> : null}
      </section>

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
