import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRODUCT_LISTING_MODULE } from "../../../../../../../modules/product-listing"
import type ProductListingModuleService from "../../../../../../../modules/product-listing/service"
import { PRODUCT_TRANSLATION_MODULE } from "../../../../../../../modules/product-translation"
import type ProductTranslationModuleService from "../../../../../../../modules/product-translation/service"
import { isValidTransition } from "../../../../../../../modules/product-translation/state-machine"
import { AUDIT_LOG_MODULE } from "../../../../../../../modules/audit-log"
import type AuditLogModuleService from "../../../../../../../modules/audit-log/service"
import { resolveVendorId } from "../../../../../utils"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
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

  const productTranslationModuleService: ProductTranslationModuleService = req.scope.resolve(
    PRODUCT_TRANSLATION_MODULE
  )
  const [translation] = await productTranslationModuleService.listProductTranslations({
    product_id: listing.product_id,
    locale: req.params.locale,
  })
  if (!translation) {
    res.status(404).json({ message: "No translation draft found for this locale" })
    return
  }
  if (!isValidTransition(translation.status, "pending_review")) {
    res.status(422).json({
      message: `Cannot submit a translation with status "${translation.status}"`,
    })
    return
  }

  const previousStatus = translation.status
  const updated = await productTranslationModuleService.updateProductTranslations({
    id: translation.id,
    status: "pending_review",
    submitted_at: new Date(),
  })

  const auditLogModuleService: AuditLogModuleService = req.scope.resolve(AUDIT_LOG_MODULE)
  await auditLogModuleService.record({
    actorType: "seller_user",
    actorId: req.auth_context.actor_id,
    action: "product_translation.submitted",
    entityType: "product_translation",
    entityId: translation.id,
    vendorId,
    beforeState: { status: previousStatus },
    afterState: { status: "pending_review" },
  })

  res.json({ translation: { id: updated.id, status: updated.status } })
}
