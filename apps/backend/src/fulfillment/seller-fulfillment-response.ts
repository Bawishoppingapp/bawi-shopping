import type { MedusaContainer } from "@medusajs/framework/types"
import { MARKETPLACE_ORDER_MODULE } from "../modules/marketplace-order"
import type OrderModuleService from "../modules/marketplace-order/service"
import { FULFILLMENT_PRIVACY_MODULE } from "../modules/fulfillment-privacy"
import type FulfillmentPrivacyModuleService from "../modules/fulfillment-privacy/service"

export interface SellerFulfillmentItem {
  id: string
  product_code: string | null
  title: string
  color: string | null
  size: string | null
  quantity: number
}

export interface SellerFulfillmentOrder {
  id: string
  status: string
  fulfillment_code: string
  fulfillment_deadline_at: string
  preparing_at: string | null
  ready_for_pickup_at: string | null
  picked_up_at: string | null
  out_for_delivery_at: string | null
  delivered_at: string | null
  earnings: number
  items: SellerFulfillmentItem[]
  // Only present once ready_for_pickup - the seller's own copy to
  // display/print for the courier at handoff. Never the tracking_code,
  // which is the customer's own delivery-confirmation code.
  pickup_code: string | null
}

interface RawVendorOrderForSeller {
  id: string
  status: string
  fulfillment_code: string
  fulfillment_deadline_at: Date | string
  preparing_at: Date | string | null
  ready_for_pickup_at: Date | string | null
  picked_up_at: Date | string | null
  out_for_delivery_at: Date | string | null
  delivered_at: Date | string | null
  subtotal_amount: number
  commission_amount: number
  total_amount: number
  items: Array<{
    id: string
    product_code: string | null
    title: string
    color: string | null
    size: string | null
    quantity: number
  }>
}

/**
 * Pure shaping, no I/O - by construction never touches the parent order's
 * customer_id/shipping_address (docs/SECURITY.md §11, CLAUDE.md rule #12).
 * Both the list and detail routes call this after loading their own
 * vendor_order(s), so a list of N orders costs one batched pickup-code
 * lookup, not N re-fetches of the same row (see docs/DECISIONS.md).
 */
export function toSellerFulfillmentOrder(
  vendorOrder: RawVendorOrderForSeller,
  pickupCode: string | null
): SellerFulfillmentOrder {
  return {
    id: vendorOrder.id,
    status: vendorOrder.status,
    fulfillment_code: vendorOrder.fulfillment_code,
    fulfillment_deadline_at: vendorOrder.fulfillment_deadline_at as unknown as string,
    preparing_at: vendorOrder.preparing_at as unknown as string | null,
    ready_for_pickup_at: vendorOrder.ready_for_pickup_at as unknown as string | null,
    picked_up_at: vendorOrder.picked_up_at as unknown as string | null,
    out_for_delivery_at: vendorOrder.out_for_delivery_at as unknown as string | null,
    delivered_at: vendorOrder.delivered_at as unknown as string | null,
    earnings: vendorOrder.subtotal_amount - vendorOrder.commission_amount,
    items: vendorOrder.items.map((item) => ({
      id: item.id,
      product_code: item.product_code,
      title: item.title,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
    })),
    pickup_code: pickupCode,
  }
}

function isPastPreparation(status: string): boolean {
  return status !== "awaiting_preparation" && status !== "preparing"
}

/** Batched form - one query for every vendor_order's pickup code instead
 * of one per row. Use this for any list of more than one vendor_order. */
export async function shapeVendorOrdersForSeller(
  container: MedusaContainer,
  vendorOrders: RawVendorOrderForSeller[]
): Promise<SellerFulfillmentOrder[]> {
  const eligibleIds = vendorOrders
    .filter((vendorOrder) => isPastPreparation(vendorOrder.status))
    .map((vendorOrder) => vendorOrder.id)

  const fulfillmentPrivacyModuleService: FulfillmentPrivacyModuleService = container.resolve(
    FULFILLMENT_PRIVACY_MODULE
  )
  const codes = eligibleIds.length
    ? await fulfillmentPrivacyModuleService.listPickupCodes({ vendor_order_id: eligibleIds })
    : []
  const codeByVendorOrderId = new Map(codes.map((code) => [code.vendor_order_id, code.code]))

  return vendorOrders.map((vendorOrder) =>
    toSellerFulfillmentOrder(vendorOrder, codeByVendorOrderId.get(vendorOrder.id) ?? null)
  )
}

/** Single-item convenience wrapper for the detail route. */
export async function shapeVendorOrderForSeller(
  container: MedusaContainer,
  vendorOrderId: string
): Promise<SellerFulfillmentOrder> {
  const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
  const vendorOrder = await orderModuleService.retrieveVendorOrder(vendorOrderId, {
    relations: ["items"],
  })
  const [shaped] = await shapeVendorOrdersForSeller(container, [vendorOrder])
  return shaped
}
