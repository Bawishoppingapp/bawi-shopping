import type { MedusaContainer } from "@medusajs/framework/types"
import { MARKETPLACE_ORDER_MODULE } from "../modules/marketplace-order"
import type OrderModuleService from "../modules/marketplace-order/service"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"
import { resolvePublicBrand } from "../modules/seller/public-brand"
import { FULFILLMENT_PRIVACY_MODULE } from "../modules/fulfillment-privacy"
import type FulfillmentPrivacyModuleService from "../modules/fulfillment-privacy/service"

export interface PublicOrderItem {
  id: string
  product_code: string | null
  title: string
  thumbnail: string | null
  color: string | null
  size: string | null
  unit_price: number
  quantity: number
  line_total: number
}

export interface PublicVendorOrder {
  id: string
  brand: string
  status: string
  fulfillment_code: string
  subtotal: number
  shipping: number
  tax: number
  total: number
  items: PublicOrderItem[]
  timeline: {
    preparing_at: string | null
    ready_for_pickup_at: string | null
    picked_up_at: string | null
    out_for_delivery_at: string | null
    delivered_at: string | null
  }
  // The customer's own delivery-confirmation code (proof of delivery) -
  // share this with the courier at the door. Never the pickup_code, which
  // is seller/courier-facing only (see docs/DECISIONS.md).
  delivery_confirmation_code: string | null
}

export interface PublicOrder {
  id: string
  display_id: string
  status: string
  payment_status: string
  currency_code: string
  subtotal: number
  shipping: number
  tax: number
  total: number
  shipping_address: Record<string, unknown>
  vendor_orders: PublicVendorOrder[]
  created_at: string
}

/**
 * Shapes an order (with its vendor_orders/items loaded) for any
 * customer-facing response - never includes vendor_id, seller id, or
 * private SKU, only a resolved public brand string, same discipline as
 * cart-response.ts's refreshAndShapeCart() (see CLAUDE.md rule #12,
 * docs/SECURITY.md §11).
 */
export async function shapeOrderForCustomer(
  container: MedusaContainer,
  orderId: string
): Promise<PublicOrder> {
  const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
  const sellerModuleService: SellerModuleService = container.resolve(SELLER_MODULE)

  const order = await orderModuleService.retrieveMarketplaceOrder(orderId, {
    relations: ["vendor_orders", "vendor_orders.items"],
  })

  const vendorIds = Array.from(new Set(order.vendor_orders.map((vo) => vo.vendor_id)))
  const sellers = vendorIds.length
    ? await sellerModuleService.listSellers(
        { id: vendorIds },
        { select: ["id", "name", "public_brand_display_approved"] }
      )
    : []
  const sellerById = new Map(sellers.map((seller) => [seller.id, seller]))

  const fulfillmentPrivacyModuleService: FulfillmentPrivacyModuleService = container.resolve(
    FULFILLMENT_PRIVACY_MODULE
  )
  const vendorOrderIds = order.vendor_orders.map((vo) => vo.id)
  const trackingCodes = vendorOrderIds.length
    ? await fulfillmentPrivacyModuleService.listTrackingCodes({ vendor_order_id: vendorOrderIds })
    : []
  const trackingCodeByVendorOrderId = new Map(
    trackingCodes.map((code) => [code.vendor_order_id, code.code])
  )

  return {
    id: order.id,
    display_id: order.display_id,
    status: order.status,
    payment_status: order.payment_status,
    currency_code: order.currency_code,
    subtotal: order.subtotal_amount,
    shipping: order.shipping_amount,
    tax: order.tax_amount,
    total: order.total_amount,
    shipping_address: order.shipping_address as Record<string, unknown>,
    created_at: order.created_at as unknown as string,
    vendor_orders: order.vendor_orders.map((vendorOrder) => {
      const seller = sellerById.get(vendorOrder.vendor_id)
      return {
        id: vendorOrder.id,
        brand: seller
          ? resolvePublicBrand(seller)
          : resolvePublicBrand({ name: "", public_brand_display_approved: false }),
        status: vendorOrder.status,
        fulfillment_code: vendorOrder.fulfillment_code,
        subtotal: vendorOrder.subtotal_amount,
        shipping: vendorOrder.shipping_amount,
        tax: vendorOrder.tax_amount,
        total: vendorOrder.total_amount,
        items: vendorOrder.items.map((item) => ({
          id: item.id,
          product_code: item.product_code,
          title: item.title,
          thumbnail: item.thumbnail,
          color: item.color,
          size: item.size,
          unit_price: item.unit_price_amount,
          quantity: item.quantity,
          line_total: item.line_total_amount,
        })),
        timeline: {
          preparing_at: vendorOrder.preparing_at as unknown as string | null,
          ready_for_pickup_at: vendorOrder.ready_for_pickup_at as unknown as string | null,
          picked_up_at: vendorOrder.picked_up_at as unknown as string | null,
          out_for_delivery_at: vendorOrder.out_for_delivery_at as unknown as string | null,
          delivered_at: vendorOrder.delivered_at as unknown as string | null,
        },
        delivery_confirmation_code: trackingCodeByVendorOrderId.get(vendorOrder.id) ?? null,
      }
    }),
  }
}
