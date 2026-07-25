import "server-only"

const MEDUSA_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export class ProductsClientError extends Error {
  fieldErrors?: Record<string, string[]>

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message)
    this.name = "ProductsClientError"
    this.fieldErrors = fieldErrors
  }
}

async function parseJson(response: Response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

async function request(
  path: string,
  sessionToken: string,
  init?: RequestInit
) {
  const response = await fetch(`${MEDUSA_BACKEND_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
    cache: "no-store",
  })

  const data = await parseJson(response)

  if (!response.ok) {
    throw new ProductsClientError(data.message || "Request failed", data.errors)
  }

  return data
}

export type ProductVariantInput = {
  color: string
  size: string
  price?: number
  inventory_quantity: number
}

export type ProductDraftInput = {
  title: string
  description: string
  category_id: string
  base_price: number
  variants: ProductVariantInput[]
}

export interface CategoryOption {
  id: string
  name: string
}

export async function listCategories(sessionToken: string): Promise<CategoryOption[]> {
  const data = await request("/seller/categories", sessionToken)
  return data.categories
}

export async function listMyProducts(sessionToken: string) {
  const data = await request("/seller/products", sessionToken)
  return data.products as Array<{
    listing: { id: string; status: string; product_code: string }
    product: { id: string; title: string; thumbnail: string | null; status: string } | null
  }>
}

export async function getMyProduct(sessionToken: string, listingId: string) {
  const data = await request(`/seller/products/${listingId}`, sessionToken)
  return data as { listing: SellerProductListing; product: SellerProductDetail }
}

export interface SellerProductListing {
  id: string
  product_id: string
  vendor_id: string
  product_code: string
  status: "draft" | "pending_review" | "approved" | "rejected" | "archived"
  rejection_reason: string | null
  submitted_at: string | null
}

export interface SellerProductVariant {
  id: string
  title: string
  sku: string | null
  options: Array<{ value: string; option?: { title: string } }>
  inventory_quantity: number
  price: number | null
}

export interface SellerProductDetail {
  id: string
  title: string
  description: string | null
  thumbnail: string | null
  images: Array<{ id: string; url: string }>
  categories: Array<{ id: string; name: string }>
  variants: SellerProductVariant[]
}

export async function createProduct(
  sessionToken: string,
  input: ProductDraftInput
) {
  const data = await request("/seller/products", sessionToken, {
    method: "POST",
    body: JSON.stringify(input),
  })
  return data as { listing: SellerProductListing }
}

export async function updateProduct(
  sessionToken: string,
  listingId: string,
  input: ProductDraftInput
) {
  const data = await request(`/seller/products/${listingId}`, sessionToken, {
    method: "PUT",
    body: JSON.stringify(input),
  })
  return data as { listing: SellerProductListing }
}

export async function submitProductForReview(sessionToken: string, listingId: string) {
  const data = await request(`/seller/products/${listingId}/submit`, sessionToken, {
    method: "POST",
  })
  return data as { listing: SellerProductListing }
}

export async function uploadProductImages(
  sessionToken: string,
  listingId: string,
  files: File[],
  isPrimary: boolean
) {
  const formData = new FormData()
  for (const file of files) {
    formData.append("files", file)
  }
  formData.append("is_primary", String(isPrimary))

  const response = await fetch(
    `${MEDUSA_BACKEND_URL}/seller/products/${listingId}/images`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionToken}` },
      body: formData,
    }
  )

  const data = await parseJson(response)
  if (!response.ok) {
    throw new ProductsClientError(data.message || "Could not upload images")
  }
  return data
}
