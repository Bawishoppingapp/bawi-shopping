import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { uploadFilesWorkflow } from "@medusajs/medusa/core-flows"
import { PRODUCT_LISTING_MODULE } from "../../../../../modules/product-listing"
import type ProductListingModuleService from "../../../../../modules/product-listing/service"
import { AUDIT_LOG_MODULE } from "../../../../../modules/audit-log"
import type AuditLogModuleService from "../../../../../modules/audit-log/service"

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"])

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const adminId = req.auth_context.actor_id
  const listings: ProductListingModuleService = req.scope.resolve(PRODUCT_LISTING_MODULE)
  const listing = await listings.retrieveProductListing(req.params.id).catch(() => null)
  if (!listing) { res.status(404).json({ message: "Product listing not found" }); return }
  const action = String((req.body as Record<string, unknown> | undefined)?.action ?? "upload")
  if (action === "approve") {
    if (!listing.ai_preview_url) { res.status(409).json({ message: "Upload a generated preview first." }); return }
    await listings.updateProductListings({ id: listing.id, ai_preview_status: "approved", ai_preview_reviewed_by: adminId, ai_preview_reviewed_at: new Date(), ai_preview_rejection_reason: null })
  } else if (action === "reject") {
    const reason = String((req.body as Record<string, unknown>)?.reason ?? "").trim()
    if (reason.length < 3) { res.status(400).json({ message: "A rejection reason is required." }); return }
    await listings.updateProductListings({ id: listing.id, ai_preview_status: "rejected", ai_preview_reviewed_by: adminId, ai_preview_reviewed_at: new Date(), ai_preview_rejection_reason: reason })
  } else {
    const file = req.file as Express.Multer.File | undefined
    if (!file || !ALLOWED.has(file.mimetype) || file.size > 8 * 1024 * 1024) { res.status(400).json({ message: "Upload one JPEG, PNG, or WebP preview up to 8 MB." }); return }
    const { result } = await uploadFilesWorkflow(req.scope).run({ input: { files: [{ filename: file.originalname, mimeType: file.mimetype, content: file.buffer.toString("base64"), access: "public" as const }] } })
    await listings.updateProductListings({ id: listing.id, ai_preview_url: result[0].url, ai_preview_status: "generated", ai_preview_generated_by: adminId, ai_preview_generated_at: new Date(), ai_preview_reviewed_by: null, ai_preview_reviewed_at: null, ai_preview_rejection_reason: null })
  }
  const updated = await listings.retrieveProductListing(listing.id)
  const audit: AuditLogModuleService = req.scope.resolve(AUDIT_LOG_MODULE)
  await audit.record({ actorType: "user", actorId: adminId, action: `product.ai_preview_${action}`, entityType: "product_listing", entityId: listing.id, vendorId: listing.vendor_id, beforeState: { status: listing.ai_preview_status }, afterState: { status: updated.ai_preview_status, url: updated.ai_preview_url } })
  res.json({ listing: updated })
}
