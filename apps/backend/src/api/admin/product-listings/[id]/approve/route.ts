import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRODUCT_LISTING_MODULE } from "../../../../../modules/product-listing"
import type ProductListingModuleService from "../../../../../modules/product-listing/service"
import { isValidTransition } from "../../../../../modules/product-listing/state-machine"
import { approveProductListingWorkflow } from "../../../../../workflows/approve-product-listing"

/**
 * Admin-only (see middlewares.ts). Idempotent: re-approving an
 * already-approved listing is a no-op, not a duplicate audit entry.
 */
export async function POST(
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

  if (listing.status === "approved") {
    res.json({ listing, already_approved: true })
    return
  }

  if (!isValidTransition(listing.status, "approved")) {
    res.status(422).json({
      message: `Cannot approve a product with status "${listing.status}"`,
    })
    return
  }

  const adminUserId = req.auth_context.actor_id

  const { result } = await approveProductListingWorkflow(req.scope).run({
    input: {
      listingId: listing.id,
      productId: listing.product_id,
      vendorId: listing.vendor_id,
      adminUserId,
      previousStatus: listing.status,
    },
  })

  res.json({ listing: result.listing, product: result.product })
}
