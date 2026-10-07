import { AUDIT_LOG_MODULE } from "../../../../../modules/audit-log"
import type AuditLogModuleService from "../../../../../modules/audit-log/service"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { PRODUCT_LISTING_MODULE } from "../../../../../modules/product-listing"
import type ProductListingModuleService from "../../../../../modules/product-listing/service"
import { imageAction } from "../../../../../product-images/service"
import { imageProvider } from "../../../../../product-images/provider"

const command = z.object({ action: z.enum(["request", "regenerate", "retry", "approve_source", "approve", "reject", "mismatch"]), sources: z.unknown().optional(), reason: z.string().max(500).optional() })
async function find(req: AuthenticatedMedusaRequest) {
  const listings: ProductListingModuleService = req.scope.resolve(PRODUCT_LISTING_MODULE)
  return listings.retrieveProductListing(req.params.id).catch(() => null)
}
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const listing = await find(req)
  if (!listing) { res.status(404).json({ message: "Product not found" }); return }
  const audit: AuditLogModuleService = req.scope.resolve(AUDIT_LOG_MODULE)
  const entries = await audit.listAuditLogs({ entity_type: "product_listing", entity_id: listing.id }, { take: 50, order: { created_at: "DESC" } })
  res.json({ configured: Boolean(imageProvider()), workflow: listing.ai_image_workflow, audit: entries.map((entry) => ({ id: entry.id, action: entry.action, actor: entry.actor_id, at: entry.created_at })) })
}
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const listing = await find(req)
  if (!listing) { res.status(404).json({ message: "Product not found" }); return }
  const parsed = command.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ message: "Invalid image workflow request" }); return }
  const result = await imageAction(req.scope, listing.id, { type: "user", id: req.auth_context.actor_id, vendorId: listing.vendor_id }, parsed.data.action, parsed.data.sources ?? parsed.data.reason)
  res.status(202).json({ configured: Boolean(imageProvider()), workflow: result })
}
