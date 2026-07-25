import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { resolveVendorId } from "../../../utils"
import { PRODUCT_LISTING_MODULE } from "../../../../../modules/product-listing"
import type ProductListingModuleService from "../../../../../modules/product-listing/service"
import { isValidTransition } from "../../../../../modules/product-listing/state-machine"
import { AUDIT_LOG_MODULE } from "../../../../../modules/audit-log"
import type AuditLogModuleService from "../../../../../modules/audit-log/service"

/**
 * A seller submits their own draft (or previously-rejected) product for
 * admin review. Requires at least one variant to exist - a product can't
 * be approved without a purchasable variant (see docs/PRD.md §9.6).
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const vendorId = await resolveVendorId(req)
  if (!vendorId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const productListingModuleService: ProductListingModuleService = req.scope.resolve(
    PRODUCT_LISTING_MODULE
  )

  const [listing] = await productListingModuleService.listProductListings({
    id: req.params.id,
    vendor_id: vendorId,
  })

  if (!listing) {
    res.status(404).json({ message: "Product not found" })
    return
  }

  if (!isValidTransition(listing.status, "pending_review")) {
    res.status(422).json({
      message: `Cannot submit a product with status "${listing.status}"`,
    })
    return
  }

  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const product = await productModuleService.retrieveProduct(listing.product_id, {
    relations: ["variants"],
  })

  if (!product.variants?.length) {
    res.status(422).json({
      message: "Add at least one color/size variant before submitting for review",
    })
    return
  }

  const previousStatus = listing.status

  const updated = await productListingModuleService.updateProductListings({
    id: listing.id,
    status: "pending_review",
    submitted_at: new Date(),
  })

  const auditLogModuleService: AuditLogModuleService = req.scope.resolve(AUDIT_LOG_MODULE)
  await auditLogModuleService.record({
    actorType: "seller_user",
    actorId: req.auth_context.actor_id,
    action: "product_listing.submitted",
    entityType: "product_listing",
    entityId: listing.id,
    vendorId,
    beforeState: { status: previousStatus },
    afterState: { status: "pending_review" },
  })

  res.json({ listing: updated })
}
