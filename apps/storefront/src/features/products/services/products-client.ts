const MEDUSA_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export interface PublicProductVariant {
  id: string
  color: string
  size: string
  price: number | null
  available_quantity: number
}

export interface PublicProduct {
  product_code: string
  title: string
  description: string | null
  brand: string
  images: string[]
  thumbnail: string | null
  colors: string[]
  sizes: string[]
  base_price: number
  variants: PublicProductVariant[]
}

/** Public, unauthenticated - only ever returns an approved product.
 * Passing `locale` resolves an approved translation for that locale where
 * one exists, falling back to the product's own (English) title/
 * description otherwise - see docs/DECISIONS.md. */
export async function getPublicProduct(
  code: string,
  locale?: string
): Promise<PublicProduct | null> {
  const query = locale ? `?locale=${encodeURIComponent(locale)}` : ""
  const response = await fetch(`${MEDUSA_BACKEND_URL}/products/${code}${query}`, {
    cache: "no-store",
  })

  if (!response.ok) {
    return null
  }

  const data = await response.json()
  return data.product as PublicProduct
}
