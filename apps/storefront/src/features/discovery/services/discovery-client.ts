const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export interface CategoryNode {
  id: string
  name: string
  handle: string
  parent_category_id: string | null
  children: CategoryNode[]
}

export interface ProductHit {
  productCode: string
  title: string
  brand: string
  thumbnail: string | null
  priceMin: number | null
  priceMax: number | null
  available: boolean
  categoryIds: string[]
}

export interface ProductSearchFacets {
  sizes: string[]
  colors: string[]
}

export interface ProductSearchResponse {
  products: ProductHit[]
  next_cursor: string | null
  has_more: boolean
  facets: ProductSearchFacets
}

/** Public, unauthenticated - only active categories, translated for `locale`. */
export async function listCategories(locale: string): Promise<CategoryNode[]> {
  const response = await fetch(
    `${MEDUSA_BACKEND_URL}/categories?locale=${encodeURIComponent(locale)}`,
    { cache: "no-store" }
  )
  if (!response.ok) {
    throw new Error(`Failed to load categories (${response.status})`)
  }
  const data = await response.json()
  return data.categories as CategoryNode[]
}

export function flattenCategories(categories: CategoryNode[]): CategoryNode[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children)])
}

export function flattenCategoriesWithDepth(
  categories: CategoryNode[],
  depth = 0
): { category: CategoryNode; depth: number }[] {
  return categories.flatMap((category) => [
    { category, depth },
    ...flattenCategoriesWithDepth(category.children, depth + 1),
  ])
}

export interface BrandOption {
  slug: string
  name: string
}

/** Public, unauthenticated - only brands with at least one approved product. */
export async function listBrands(): Promise<BrandOption[]> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/brands`, { cache: "no-store" })
  if (!response.ok) {
    throw new Error(`Failed to load brands (${response.status})`)
  }
  const data = await response.json()
  return data.brands as BrandOption[]
}

export type ProductSortOption = "newest" | "price_asc" | "price_desc"

export interface ProductSearchParams {
  q?: string
  category?: string
  brand?: string
  size?: string
  color?: string
  priceMin?: number
  priceMax?: number
  available?: boolean
  sort?: ProductSortOption
  cursor?: string
  limit?: number
  locale?: string
}

/** Public, unauthenticated. Only ever returns approved products - see
 * apps/backend/src/api/products/route.ts. */
export async function searchProducts(
  params: ProductSearchParams
): Promise<ProductSearchResponse> {
  const query = new URLSearchParams()
  if (params.q) query.set("q", params.q)
  if (params.category) query.set("category", params.category)
  if (params.brand) query.set("brand", params.brand)
  if (params.size) query.set("size", params.size)
  if (params.color) query.set("color", params.color)
  if (params.priceMin !== undefined) query.set("price_min", String(params.priceMin))
  if (params.priceMax !== undefined) query.set("price_max", String(params.priceMax))
  if (params.available) query.set("available", "true")
  if (params.sort) query.set("sort", params.sort)
  if (params.cursor) query.set("cursor", params.cursor)
  if (params.limit) query.set("limit", String(params.limit))
  if (params.locale) query.set("locale", params.locale)

  const response = await fetch(`${MEDUSA_BACKEND_URL}/products?${query.toString()}`, {
    cache: "no-store",
  })
  if (!response.ok) {
    throw new Error(`Failed to load products (${response.status})`)
  }
  return (await response.json()) as ProductSearchResponse
}
