import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ProductSortOption } from "@bawi/search-contract"
import { PostgresSearchService } from "../../search/postgres-search-service"

const VALID_SORTS: ProductSortOption[] = ["newest", "price_asc", "price_desc"]
const DEFAULT_LIMIT = 24
const MAX_LIMIT = 60

function parseIntParam(value: unknown): number | undefined {
  if (typeof value !== "string") {
    return undefined
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}

function parseStringParam(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length ? value.trim() : undefined
}

/**
 * Public, unauthenticated product discovery. Powers the storefront's
 * homepage, category pages, and search/filter UI. Only ever surfaces
 * `approved` product_listing rows (enforced inside PostgresSearchService,
 * not here) - never draft/pending_review/rejected/archived, and never
 * vendor_id, private SKU, or seller identity beyond the public brand name
 * (docs/PRD.md §9.6, §9.9).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const sortParam = parseStringParam(req.query.sort)
  const sort: ProductSortOption =
    sortParam && VALID_SORTS.includes(sortParam as ProductSortOption)
      ? (sortParam as ProductSortOption)
      : "newest"

  const limitParam = parseIntParam(req.query.limit)
  const limit = limitParam ? Math.min(limitParam, MAX_LIMIT) : DEFAULT_LIMIT

  const searchService = new PostgresSearchService(req.scope)

  const result = await searchService.searchProducts({
    q: parseStringParam(req.query.q),
    locale: parseStringParam(req.query.locale) ?? "en-US",
    sort,
    limit,
    cursor: parseStringParam(req.query.cursor),
    filters: {
      categoryId: parseStringParam(req.query.category),
      brandSlug: parseStringParam(req.query.brand),
      size: parseStringParam(req.query.size),
      color: parseStringParam(req.query.color),
      priceMin: parseIntParam(req.query.price_min),
      priceMax: parseIntParam(req.query.price_max),
      availableOnly: req.query.available === "true",
    },
  })

  res.json({
    products: result.items,
    next_cursor: result.nextCursor,
    has_more: result.hasMore,
    facets: result.facets,
  })
}
