import "server-only"

const MEDUSA_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export class ProductListingsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ProductListingsError"
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

export interface ProductListingSummary {
  id: string
  product_code: string
  status: "draft" | "pending_review" | "approved" | "rejected" | "archived"
  vendor_id: string
  submitted_at: string | null
}

export interface ProductSummary {
  id: string
  title: string
  thumbnail: string | null
}

export async function listProductListings(
  sessionToken: string,
  status?: string
): Promise<{ listings: Array<{ listing: ProductListingSummary; product: ProductSummary | null }> }> {
  const url = new URL(`${MEDUSA_BACKEND_URL}/admin/product-listings`)
  if (status) {
    url.searchParams.set("status", status)
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${sessionToken}` },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new ProductListingsError("Could not load products")
  }

  return (await parseJson(response)) as {
    listings: Array<{ listing: ProductListingSummary; product: ProductSummary | null }>
  }
}

export interface ProductListingDetail extends ProductListingSummary {
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  ai_preview_status: "not_requested" | "ready_for_generation" | "generated" | "approved" | "rejected"
  ai_preview_url: string | null
  ai_preview_rejection_reason: string | null
}

export async function updateAiPreview(sessionToken: string, listingId: string, formData: FormData): Promise<void> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/admin/product-listings/${listingId}/ai-preview`, { method: "POST", headers: { Authorization: `Bearer ${sessionToken}` }, body: formData })
  if (!response.ok) { const data = await parseJson(response); throw new ProductListingsError(data.message || "Could not update AI preview") }
}

export interface ProductDetail {
  id: string
  title: string
  description: string | null
  images: Array<{ id: string; url: string }>
  variants: Array<{
    id: string
    title: string
    sku: string | null
    options: Array<{ value: string; option?: { title: string } }>
  }>
  categories: Array<{ id: string; name: string }>
}

export async function getProductListing(
  sessionToken: string,
  listingId: string
): Promise<{ listing: ProductListingDetail; product: ProductDetail; seller: { id: string; name: string } }> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/admin/product-listings/${listingId}`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new ProductListingsError("Product not found")
  }

  return (await parseJson(response)) as {
    listing: ProductListingDetail
    product: ProductDetail
    seller: { id: string; name: string }
  }
}

export async function approveProductListing(
  sessionToken: string,
  listingId: string
): Promise<void> {
  const response = await fetch(
    `${MEDUSA_BACKEND_URL}/admin/product-listings/${listingId}/approve`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionToken}` },
    }
  )
  if (!response.ok) {
    const data = await parseJson(response)
    throw new ProductListingsError(data.message || "Could not approve product")
  }
}

export async function rejectProductListing(
  sessionToken: string,
  listingId: string,
  reason: string
): Promise<void> {
  const response = await fetch(
    `${MEDUSA_BACKEND_URL}/admin/product-listings/${listingId}/reject`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason }),
    }
  )
  if (!response.ok) {
    const data = await parseJson(response)
    throw new ProductListingsError(data.message || "Could not reject product")
  }
}
