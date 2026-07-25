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

/** Public, unauthenticated - only ever returns an approved product. */
export async function getPublicProduct(code: string): Promise<PublicProduct | null> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/products/${code}`, {
    cache: "no-store",
  })

  if (!response.ok) {
    return null
  }

  const data = await response.json()
  return data.product as PublicProduct
}
