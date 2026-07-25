import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type {
  ProductSearchQuery,
  ProductSearchResult,
  ProductSearchHit,
  SearchService,
} from "@bawi/search-contract"
import { PRODUCT_LISTING_MODULE } from "../modules/product-listing"
import type ProductListingModuleService from "../modules/product-listing/service"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"

const MAX_CANDIDATES = 500

// Exported for unit testing - opaque to callers, but the round-trip
// behavior (including malformed input) is worth pinning down directly.
export function decodeCursor(cursor: string | undefined): number {
  if (!cursor) {
    return 0
  }
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8")
    const offset = Number.parseInt(decoded, 10)
    return Number.isFinite(offset) && offset >= 0 ? offset : 0
  } catch {
    return 0
  }
}

export function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), "utf8").toString("base64url")
}

type VariantAgg = { available: number; prices: number[] }

/**
 * v1 "database-backed" adapter (see docs/ARCHITECTURE.md §6): queries live
 * approved product_listing + product data directly through Medusa's own
 * query engine - there is no separate index table to keep in sync, so
 * nothing can ever drift out of date with the real approval status. A
 * future higher-scale or ranked-relevance provider (Postgres tsvector/GIN,
 * or Algolia) is a new class implementing this same SearchService
 * interface - callers (the public /products route) never change. See
 * docs/DECISIONS.md for the full reasoning.
 *
 * Approved-only is enforced here, not left to the caller: every candidate
 * comes from a `status: "approved"` product_listing filter before anything
 * else runs.
 */
export class PostgresSearchService implements SearchService {
  constructor(private readonly container: MedusaContainer) {}

  async searchProducts(query: ProductSearchQuery): Promise<ProductSearchResult> {
    const productListingModuleService: ProductListingModuleService = this.container.resolve(
      PRODUCT_LISTING_MODULE
    )
    const sellerModuleService: SellerModuleService = this.container.resolve(SELLER_MODULE)
    const productModuleService = this.container.resolve(Modules.PRODUCT)
    const queryEngine = this.container.resolve(ContainerRegistrationKeys.QUERY)

    let vendorId: string | undefined
    if (query.filters.brandSlug) {
      const [seller] = await sellerModuleService.listSellers({ slug: query.filters.brandSlug })
      if (!seller) {
        return { items: [], nextCursor: null, hasMore: false, facets: { sizes: [], colors: [] } }
      }
      vendorId = seller.id
    }

    const listingFilters: Record<string, unknown> = { status: "approved" }
    if (vendorId) {
      listingFilters.vendor_id = vendorId
    }

    const listings = await productListingModuleService.listProductListings(listingFilters, {
      take: MAX_CANDIDATES,
    })
    if (!listings.length) {
      return { items: [], nextCursor: null, hasMore: false, facets: { sizes: [], colors: [] } }
    }

    const listingByProductId = new Map(listings.map((listing) => [listing.product_id, listing]))
    const sellers = await sellerModuleService.listSellers({
      id: listings.map((listing) => listing.vendor_id),
    })
    const sellerById = new Map(sellers.map((seller) => [seller.id, seller]))

    const products = await productModuleService.listProducts(
      { id: Array.from(listingByProductId.keys()) },
      { relations: ["categories", "options", "options.values", "variants"] }
    )

    const variantIds = products.flatMap((product) => product.variants?.map((v) => v.id) ?? [])
    const variantData = variantIds.length
      ? (
          await queryEngine.graph({
            entity: "product_variant",
            fields: [
              "id",
              "product_id",
              "inventory_items.inventory.location_levels.available_quantity",
              "prices.amount",
              "prices.currency_code",
            ],
            filters: { id: variantIds },
          })
        ).data
      : []

    const variantAggByProductId = new Map<string, VariantAgg>()
    for (const variant of variantData as Record<string, unknown>[]) {
      const productId = variant.product_id as string
      const items = (variant.inventory_items ?? []) as Array<{
        inventory?: { location_levels?: Array<{ available_quantity?: number }> }
      }>
      const available = items.reduce((sum, item) => {
        const levels = item.inventory?.location_levels ?? []
        return sum + levels.reduce((s, l) => s + (l.available_quantity ?? 0), 0)
      }, 0)
      const prices = (variant.prices ?? []) as Array<{ amount: number; currency_code: string }>
      const usdAmount = prices.find((p) => p.currency_code === "usd")?.amount

      const agg = variantAggByProductId.get(productId) ?? { available: 0, prices: [] }
      agg.available += available
      if (usdAmount !== undefined) {
        agg.prices.push(usdAmount)
      }
      variantAggByProductId.set(productId, agg)
    }

    const q = query.q?.trim().toLowerCase()
    const facetSizes = new Set<string>()
    const facetColors = new Set<string>()

    const hits: (ProductSearchHit & { _createdAt: string; _priceSort: number })[] = []
    for (const product of products) {
      const listing = listingByProductId.get(product.id)
      if (!listing) {
        continue
      }
      const seller = sellerById.get(listing.vendor_id)
      if (!seller) {
        continue
      }

      if (
        query.filters.categoryId &&
        !product.categories?.some((c) => c.id === query.filters.categoryId)
      ) {
        continue
      }

      if (q) {
        const haystack = `${product.title ?? ""} ${product.description ?? ""} ${seller.name}`.toLowerCase()
        if (!haystack.includes(q)) {
          continue
        }
      }

      const agg = variantAggByProductId.get(product.id) ?? { available: 0, prices: [] }
      const priceMin = agg.prices.length ? Math.min(...agg.prices) : null
      const priceMax = agg.prices.length ? Math.max(...agg.prices) : null
      const available = agg.available > 0

      if (query.filters.availableOnly && !available) {
        continue
      }
      if (
        query.filters.priceMin !== undefined &&
        (priceMin === null || priceMin < query.filters.priceMin)
      ) {
        continue
      }
      if (
        query.filters.priceMax !== undefined &&
        (priceMax === null || priceMax > query.filters.priceMax)
      ) {
        continue
      }

      // Everything up to here defines the facet scope (docs/DECISIONS.md):
      // available sizes/colors reflect category/brand/price/availability/q,
      // but not the size/color selections themselves, so picking one facet
      // doesn't hide the others.
      const sizes =
        product.options?.find((o) => o.title === "Size")?.values?.map((v) => v.value) ?? []
      const colors =
        product.options?.find((o) => o.title === "Color")?.values?.map((v) => v.value) ?? []
      for (const size of sizes) facetSizes.add(size)
      for (const color of colors) facetColors.add(color)

      if (query.filters.size && !sizes.includes(query.filters.size)) {
        continue
      }
      if (query.filters.color && !colors.includes(query.filters.color)) {
        continue
      }

      hits.push({
        productCode: listing.product_code,
        title: product.title,
        brand: seller.name,
        thumbnail: product.thumbnail ?? null,
        priceMin,
        priceMax,
        available,
        categoryIds: product.categories?.map((c) => c.id) ?? [],
        _createdAt: product.created_at as unknown as string,
        _priceSort: priceMin ?? Number.POSITIVE_INFINITY,
      })
    }

    switch (query.sort) {
      case "price_asc":
        hits.sort((a, b) => a._priceSort - b._priceSort)
        break
      case "price_desc":
        hits.sort((a, b) => b._priceSort - a._priceSort)
        break
      case "newest":
      default:
        hits.sort((a, b) => new Date(b._createdAt).getTime() - new Date(a._createdAt).getTime())
        break
    }

    const offset = decodeCursor(query.cursor)
    const page = hits.slice(offset, offset + query.limit)
    const hasMore = offset + query.limit < hits.length

    return {
      items: page.map(({ _createdAt: _a, _priceSort: _p, ...hit }) => hit),
      nextCursor: hasMore ? encodeCursor(offset + query.limit) : null,
      hasMore,
      facets: {
        sizes: Array.from(facetSizes).sort(),
        colors: Array.from(facetColors).sort(),
      },
    }
  }
}
