import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETPLACE_ORDER_MODULE } from "../../../modules/marketplace-order"
import type OrderModuleService from "../../../modules/marketplace-order/service"
import { shapeVendorOrdersForSeller } from "../../../fulfillment/seller-fulfillment-response"
import { resolveVendorId } from "../../seller/utils"

/**
 * The seller's own fulfillment queue - scoped to vendor_id derived from
 * the authenticated session, never a client-supplied value. Every row is
 * shaped by shapeVendorOrderForSeller(), which never even fetches the
 * parent order's customer_id/shipping_address (docs/SECURITY.md §11).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const vendorId = await resolveVendorId(req)
  if (!vendorId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const orderModuleService: OrderModuleService = req.scope.resolve(MARKETPLACE_ORDER_MODULE)
  const statusFilter = typeof req.query.status === "string" ? req.query.status : undefined

  const vendorOrders = await orderModuleService.listVendorOrders(
    { vendor_id: vendorId, ...(statusFilter ? { status: statusFilter } : {}) },
    { relations: ["items"], order: { created_at: "DESC" } }
  )

  const shaped = await shapeVendorOrdersForSeller(req.scope, vendorOrders)

  res.json({ fulfillment_orders: shaped })
}
