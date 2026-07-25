import { cookies } from "next/headers"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { Button, StatusBadge } from "@bawi/ui"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import {
  getMyProduct,
  listCategories,
  ProductsClientError,
} from "@/features/products/services/products-client"

// This page renders another seller's data if the caller's session doesn't
// own the requested listing (server-side, via a 404) - it must never be
// cached (by Next.js or the browser) keyed only on the URL, since the same
// URL is unauthorized for every seller except the one who owns it.
export const dynamic = "force-dynamic"
import { ProductForm } from "@/features/products/components/product-form"
import { ImageUploader } from "@/features/products/components/image-uploader"
import { updateProductAction } from "@/features/products/actions/update-product"
import { submitProductAction } from "@/features/products/actions/submit-product"
import type { VariantRow } from "@/features/products/constants"

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  let data
  try {
    data = await getMyProduct(sessionToken, id)
  } catch (error) {
    if (error instanceof ProductsClientError) {
      notFound()
    }
    throw error
  }

  const { listing, product } = data
  const isEditable = listing.status === "draft" || listing.status === "rejected"

  const variants: VariantRow[] = product.variants.map((variant) => ({
    color: variant.options.find((o) => o.option?.title === "Color")?.value ?? "",
    size: variant.options.find((o) => o.option?.title === "Size")?.value ?? "",
    price: variant.price != null ? String(variant.price) : "",
    inventory_quantity: String(variant.inventory_quantity),
  }))

  const categories = isEditable ? await listCategories(sessionToken) : []
  const boundUpdateAction = updateProductAction.bind(null, id)

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-8 px-4 py-16">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">{product.title}</h1>
          <StatusBadge status={listing.status} />
        </div>
        <p className="text-sm text-neutral-500">Product code: {listing.product_code}</p>
        <div className="flex gap-4 text-sm">
          <Link href="/products" className="text-neutral-600 underline">
            Back to products
          </Link>
          <Link href={`/products/${id}/preview`} className="text-neutral-600 underline">
            Preview
          </Link>
        </div>
      </div>

      {listing.status === "rejected" && listing.rejection_reason && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">This product was rejected.</p>
          <p>{listing.rejection_reason}</p>
          <p className="mt-1 text-red-600">
            Editing and resubmitting will move it back into review.
          </p>
        </div>
      )}

      {listing.status === "pending_review" && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
          Submitted for review - editing is disabled until an admin approves or rejects it.
        </div>
      )}

      {listing.status === "approved" && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          Approved and live on the storefront.
        </div>
      )}

      {isEditable ? (
        <ProductForm
          action={boundUpdateAction}
          categories={categories}
          submitLabel="Save changes"
          initialValues={{
            title: product.title,
            description: product.description ?? "",
            category_id: product.categories[0]?.id ?? "",
            base_price: variants[0]?.price ?? "",
            variants,
          }}
        />
      ) : (
        <div className="flex flex-col gap-2 text-sm text-neutral-700">
          <p>{product.description}</p>
          <ul className="list-disc pl-5">
            {variants.map((v, i) => (
              <li key={i}>
                {v.color} / {v.size} - qty {v.inventory_quantity}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="flex flex-col gap-3 border-t border-neutral-200 pt-6">
        <h2 className="text-lg font-semibold text-neutral-900">Images</h2>
        {product.images.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {product.images.map((image) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={image.id}
                src={image.url}
                alt={product.title}
                className="h-24 w-20 rounded object-cover"
              />
            ))}
          </ul>
        )}
        {isEditable && <ImageUploader listingId={id} />}
      </section>

      {isEditable && (
        <form action={submitProductAction.bind(null, id)}>
          <Button type="submit" variant="secondary">
            Submit for review
          </Button>
        </form>
      )}
    </main>
  )
}
