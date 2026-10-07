import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { PRODUCT_LISTING_MODULE } from "../../../../../modules/product-listing"
import type ProductListingModuleService from "../../../../../modules/product-listing/service"
import { imageAction } from "../../../../../product-images/service"
import { imageProvider } from "../../../../../product-images/provider"
import { resolveVendorId } from "../../../utils"

const command = z.object({ action: z.enum(["request", "regenerate", "retry", "approve_source", "approve", "reject", "mismatch"]), sources: z.unknown().optional(), reason: z.string().max(500).optional() })
async function find(req: AuthenticatedMedusaRequest) {
  const listings: ProductListingModuleService = req.scope.resolve(PRODUCT_LISTING_MODULE)
  const vendorId = await resolveVendorId(req)
  if (!vendorId) return null
  const [listing] = await listings.listProductListings({ id: req.params.id, vendor_id: vendorId })
  return listing ?? null
}
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const listing = await find(req)
  if (!listing) { res.status(404).json({ message: "Product not found" }); return }
  res.json({ configured: Boolean(imageProvider()), workflow: listing.ai_image_workflow })
}
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const listing = await find(req)
  if (!listing) { res.status(404).json({ message: "Product not found" }); return }
  const parsed = command.safeParse(req.body)
  if (!parsed.success) { res.status(400).json({ message: "Invalid image workflow request" }); return }
  const result = await imageAction(req.scope, listing.id, { type: "seller_user", id: req.auth_context.actor_id, vendorId: listing.vendor_id }, parsed.data.action, parsed.data.sources ?? parsed.data.reason)
  res.status(202).json({ configured: Boolean(imageProvider()), workflow: result })
}
