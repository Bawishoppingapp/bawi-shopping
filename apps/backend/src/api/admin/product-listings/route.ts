import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { PRODUCT_LISTING_MODULE } from "../../../modules/product-listing"
import type ProductListingModuleService from "../../../modules/product-listing/service"
import type { ProductListingStatus } from "../../../modules/product-listing/state-machine"

const VALID_STATUS_FILTERS: ProductListingStatus[] = [
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "archived",
]

/** Admin-only (see middlewares.ts). Optional ?status= filter. */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const productListingModuleService: ProductListingModuleService = req.scope.resolve(
    PRODUCT_LISTING_MODULE
  )
  const productModuleService = req.scope.resolve(Modules.PRODUCT)

  const statusFilter = req.query.status as string | undefined
  const filters: Record<string, unknown> = {}
  if (statusFilter && VALID_STATUS_FILTERS.includes(statusFilter as ProductListingStatus)) {
    filters.status = statusFilter
  }

  const listings = await productListingModuleService.listProductListings(filters, {
    order: { created_at: "DESC" },
  })

  if (!listings.length) {
    res.json({ listings: [] })
    return
  }

  const products = await productModuleService.listProducts(
    { id: listings.map((listing) => listing.product_id) },
    { select: ["id", "title", "thumbnail"] }
  )
  const productsById = new Map(products.map((product) => [product.id, product]))

  res.json({
    listings: listings.map((listing) => ({
      listing,
      product: productsById.get(listing.product_id) ?? null,
    })),
  })
}
