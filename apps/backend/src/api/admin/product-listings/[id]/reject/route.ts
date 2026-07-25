import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRODUCT_LISTING_MODULE } from "../../../../../modules/product-listing"
import type ProductListingModuleService from "../../../../../modules/product-listing/service"
import { isValidTransition } from "../../../../../modules/product-listing/state-machine"
import { rejectProductListingSchema } from "../../../../../modules/product-listing/schemas"
import { rejectProductListingWorkflow } from "../../../../../workflows/reject-product-listing"

/**
 * Admin-only (see middlewares.ts). The rejection reason is private - never
 * returned from a public/seller-visible-only-via-own-listing endpoint
 * beyond the seller's own record.
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const parsed = rejectProductListingSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({
      message: "Validation failed",
      errors: parsed.error.flatten().fieldErrors,
    })
    return
  }

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

  if (listing.status === "rejected") {
    res.json({ listing, already_rejected: true })
    return
  }

  if (!isValidTransition(listing.status, "rejected")) {
    res.status(422).json({
      message: `Cannot reject a product with status "${listing.status}"`,
    })
    return
  }

  const adminUserId = req.auth_context.actor_id

  const { result } = await rejectProductListingWorkflow(req.scope).run({
    input: {
      listingId: listing.id,
      vendorId: listing.vendor_id,
      reason: parsed.data.reason,
      adminUserId,
      previousStatus: listing.status,
    },
  })

  res.json({ listing: result.listing })
}
