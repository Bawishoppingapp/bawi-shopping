import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_ORDER_MODULE } from "../modules/marketplace-order"
import type OrderModuleService from "../modules/marketplace-order/service"

export interface CourierAssignmentItem {
  title: string
  color: string | null
  size: string | null
  quantity: number
}

export interface CourierAssignment {
  id: string
  status: string
  fulfillment_code: string
  fulfillment_deadline_at: string
  pickup_location: {
    name: string
    address_1: string | null
    city: string | null
  }
  items: CourierAssignmentItem[]
}

/**
 * Shapes a vendor_order for the courier CURRENTLY assigned to it - never
 * the seller's real name, never any order financials (price, commission),
 * never any customer PII (name, phone, email, delivery address). Only
 * what a handoff requires: what to pick up, where, and its deadline - see
 * docs/USER-ROLES.md §2.7, docs/SECURITY.md §11.
 *
 * `pickup_location` always resolves through the same shared stock
 * location every seller's inventory already uses (see
 * apps/backend/src/workflows/shared/default-stock-location.ts) - a real
 * per-order resolution path, not a hardcoded string, so a future
 * per-vendor-location or sorting-hub model only has to change what this
 * resolves *to*, not this function's shape (see docs/DECISIONS.md).
 */
export async function shapeVendorOrderForCourier(
  container: MedusaContainer,
  vendorOrderId: string
): Promise<CourierAssignment> {
  const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
  const stockLocationModuleService = container.resolve(Modules.STOCK_LOCATION)

  const vendorOrder = await orderModuleService.retrieveVendorOrder(vendorOrderId, {
    relations: ["items"],
  })

  const [location] = await stockLocationModuleService.listStockLocations(
    {},
    { relations: ["address"], take: 1 }
  )

  return {
    id: vendorOrder.id,
    status: vendorOrder.status,
    fulfillment_code: vendorOrder.fulfillment_code,
    fulfillment_deadline_at: vendorOrder.fulfillment_deadline_at as unknown as string,
    pickup_location: {
      name: location?.name ?? "Bawi Fulfillment Center",
      address_1: location?.address?.address_1 ?? null,
      city: location?.address?.city ?? null,
    },
    items: vendorOrder.items.map((item) => ({
      title: item.title,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
    })),
  }
}
