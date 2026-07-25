import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRODUCT_LISTING_MODULE } from "../../modules/product-listing"
import type ProductListingModuleService from "../../modules/product-listing/service"
import { SELLER_MODULE } from "../../modules/seller"
import type SellerModuleService from "../../modules/seller/service"

/**
 * Public, unauthenticated. Powers the storefront's brand filter - only
 * sellers with at least one `approved` listing, and only their public name
 * + slug (never vendor_id or any other seller record field).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const productListingModuleService: ProductListingModuleService = req.scope.resolve(
    PRODUCT_LISTING_MODULE
  )
  const sellerModuleService: SellerModuleService = req.scope.resolve(SELLER_MODULE)

  const approvedListings = await productListingModuleService.listProductListings({
    status: "approved",
  })
  const vendorIds = Array.from(new Set(approvedListings.map((listing) => listing.vendor_id)))

  if (!vendorIds.length) {
    res.json({ brands: [] })
    return
  }

  const sellers = await sellerModuleService.listSellers(
    { id: vendorIds },
    { select: ["id", "name", "slug"], order: { name: "ASC" } }
  )

  res.json({
    brands: sellers.map((seller) => ({ slug: seller.slug, name: seller.name })),
  })
}
