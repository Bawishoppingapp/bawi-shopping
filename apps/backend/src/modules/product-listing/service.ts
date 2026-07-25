import { MedusaService } from "@medusajs/framework/utils"
import { ProductListing } from "./models/product-listing"

// Vendor scoping note: every method below is inherited from MedusaService's
// generated CRUD (retrieveProductListing, listProductListings, ...).
// Callers must always pass the vendor id derived from req.auth_context
// (see src/api/seller/me/route.ts) - never a client-supplied id - to keep
// sellers from reaching each other's listings.
class ProductListingModuleService extends MedusaService({
  ProductListing,
}) {}

export default ProductListingModuleService
