import { notFound } from "next/navigation"
import { translate } from "@bawi/i18n"
import { getLocale } from "@bawi/i18n/server"
import { getPublicProduct } from "@/features/products/services/products-client"
import { AddToCartForm } from "@/features/cart/components/add-to-cart-form"

function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const locale = await getLocale()
  const product = await getPublicProduct(code, locale)

  if (!product) {
    notFound()
  }

  const totalAvailable = product.variants.reduce((sum, v) => sum + v.available_quantity, 0)

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-4 py-16 md:flex-row">
      <div className="flex flex-1 flex-wrap gap-2">
        {product.images.length === 0 ? (
          <div className="flex h-80 w-full items-center justify-center rounded-md bg-neutral-100 text-sm text-neutral-400">
            {product.title}
          </div>
        ) : (
          product.images.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt={product.title}
              className="h-80 w-64 rounded-md object-cover"
            />
          ))
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">{product.title}</h1>
        <p className="text-sm text-neutral-500">
          {translate(locale, "product.soldBy")} {product.brand}
        </p>
        <p className="text-xl text-neutral-900">{formatUsd(product.base_price)}</p>
        <p className="text-sm text-neutral-600">{product.description}</p>

        <div className="flex flex-col gap-1 text-sm">
          <p>
            <span className="font-medium">{translate(locale, "product.colors")}:</span>{" "}
            {product.colors.join(", ")}
          </p>
          <p>
            <span className="font-medium">{translate(locale, "product.sizes")}:</span>{" "}
            {product.sizes.join(", ")}
          </p>
        </div>

        <p
          className={
            "text-sm font-medium " + (totalAvailable > 0 ? "text-green-700" : "text-red-600")
          }
        >
          {totalAvailable > 0
            ? translate(locale, "product.inStock")
            : translate(locale, "product.outOfStock")}
        </p>

        <div className="mt-2">
          <AddToCartForm variants={product.variants} />
        </div>

        <table className="mt-2 w-full text-left text-sm">
          <thead className="text-neutral-500">
            <tr>
              <th className="py-1 font-medium">{translate(locale, "product.colors")}</th>
              <th className="py-1 font-medium">{translate(locale, "product.sizes")}</th>
              <th className="py-1 font-medium" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {product.variants.map((variant) => (
              <tr key={variant.id} className="border-t border-neutral-100">
                <td className="py-1.5">{variant.color}</td>
                <td className="py-1.5">{variant.size}</td>
                <td className="py-1.5">
                  {variant.available_quantity > 0
                    ? translate(locale, "product.inStock")
                    : translate(locale, "product.outOfStock")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
