import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { PRODUCT_LISTING_MODULE } from "../../../../modules/product-listing"
import type ProductListingModuleService from "../../../../modules/product-listing/service"
import { SELLER_MODULE } from "../../../../modules/seller"
import type SellerModuleService from "../../../../modules/seller/service"

/** Admin-only (see middlewares.ts). */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const productListingModuleService: ProductListingModuleService = req.scope.resolve(
    PRODUCT_LISTING_MODULE
  )

  let listing
  try {
    listing = await productListingModuleService.retrieveProductListing(req.params.id)
  } catch {
    res.status(404).json({ message: "Product listing not found" })
    return
  }

  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const product = await productModuleService.retrieveProduct(listing.product_id, {
    relations: ["variants", "variants.options", "options", "options.values", "images", "categories"],
  })

  const sellerModuleService: SellerModuleService = req.scope.resolve(SELLER_MODULE)
  const seller = await sellerModuleService.retrieveSeller(listing.vendor_id)

  res.json({ listing, product, seller: { id: seller.id, name: seller.name } })
}
