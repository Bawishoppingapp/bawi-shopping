// SearchService interface - see docs/ARCHITECTURE.md §6. Backend-only
// (Medusa has no dependency on React/Next.js), so this package stays plain
// TypeScript with zero runtime dependencies. Any caller (an API route, a
// future worker) programs against this interface, never against a specific
// adapter directly - swapping the v1 Postgres adapter for Algolia later is
// a new file implementing this same interface, not a rewrite of callers.

export type ProductSortOption = "newest" | "price_asc" | "price_desc"

export interface ProductSearchFilters {
  categoryId?: string
  brandSlug?: string
  size?: string
  color?: string
  priceMin?: number
  priceMax?: number
  availableOnly?: boolean
}

export interface ProductSearchQuery {
  q?: string
  locale: string
  filters: ProductSearchFilters
  sort: ProductSortOption
  cursor?: string
  limit: number
}

export interface ProductSearchHit {
  productCode: string
  title: string
  brand: string
  thumbnail: string | null
  priceMin: number | null
  priceMax: number | null
  // The selling seller's currency (see apps/backend's Seller.currency_code)
  // - null only for a hit with no resolvable price (priceMin/priceMax
  // both null), same "absent, not guessed" convention as those fields.
  currencyCode: string | null
  available: boolean
  categoryIds: string[]
}

export interface ProductSearchFacets {
  sizes: string[]
  colors: string[]
}

export interface ProductSearchResult {
  items: ProductSearchHit[]
  nextCursor: string | null
  hasMore: boolean
  facets: ProductSearchFacets
}

export interface SearchService {
  searchProducts(query: ProductSearchQuery): Promise<ProductSearchResult>
}
