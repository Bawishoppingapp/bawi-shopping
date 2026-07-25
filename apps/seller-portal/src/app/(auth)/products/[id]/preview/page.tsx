import { cookies } from "next/headers"
import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import { getMyProduct, ProductsClientError } from "@/features/products/services/products-client"

// Same reasoning as the edit page - never cache a URL whose authorized
// content depends on which seller's session requested it.
export const dynamic = "force-dynamic"

function formatUsd(cents: number | null): string {
  if (cents == null) return "—"
  return `$${(cents / 100).toFixed(2)}`
}

export default async function ProductPreviewPage({
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
  const colors = Array.from(
    new Set(
      product.variants
        .map((v) => v.options.find((o) => o.option?.title === "Color")?.value)
        .filter((v): v is string => Boolean(v))
    )
  )
  const sizes = Array.from(
    new Set(
      product.variants
        .map((v) => v.options.find((o) => o.option?.title === "Size")?.value)
        .filter((v): v is string => Boolean(v))
    )
  )
  const lowestPrice = product.variants.reduce<number | null>((min, v) => {
    if (v.price == null) return min
    return min == null ? v.price : Math.min(min, v.price)
  }, null)

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-16">
      <div className="flex items-center justify-between">
        <Link href={`/products/${id}`} className="text-sm text-neutral-600 underline">
          Back to edit
        </Link>
        <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-600">
          Preview - this is how customers will see it once approved
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {product.images.length === 0 && (
          <div className="flex h-64 w-full items-center justify-center rounded-md bg-neutral-100 text-sm text-neutral-400">
            No images yet
          </div>
        )}
        {product.images.map((image) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={image.id}
            src={image.url}
            alt={product.title}
            className="h-64 w-52 rounded-md object-cover"
          />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-neutral-900">{product.title}</h1>
        <p className="text-lg text-neutral-900">{formatUsd(lowestPrice)}</p>
        <p className="text-sm text-neutral-600">{product.description}</p>
        <p className="text-xs text-neutral-400">Product code: {listing.product_code}</p>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <p>
          <span className="font-medium">Colors:</span> {colors.join(", ") || "—"}
        </p>
        <p>
          <span className="font-medium">Sizes:</span> {sizes.join(", ") || "—"}
        </p>
      </div>
    </main>
  )
}
