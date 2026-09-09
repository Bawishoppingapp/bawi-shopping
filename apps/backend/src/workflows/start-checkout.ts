import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_ORDER_MODULE } from "../modules/marketplace-order"
import type OrderModuleService from "../modules/marketplace-order/service"

/**
 * Checkout-start touches inventory (a soft reservation per line item),
 * this platform's own Order row, and Stripe (one PaymentIntent) - three
 * external-ish systems that must all succeed together or none should
 * stick, same atomicity reasoning as approve-seller-application.ts. The
 * idempotency check itself (has this idempotency_key already been used?)
 * happens in the route before this workflow ever runs - see
 * src/api/store/checkout/route.ts - so every run of this workflow is
 * always creating a genuinely new order.
 */

export interface CheckoutLineItemSnapshot {
  variantId: string | null
  vendorId: string
  productId: string
  productCode: string
  title: string
  thumbnail: string | null
  color: string | null
  size: string | null
  unitPriceCents: number
  quantity: number
  inventoryItemId: string | null
}

type ReserveInventoryInput = {
  items: CheckoutLineItemSnapshot[]
  locationId: string
}

const reserveInventoryStep = createStep(
  "reserve-inventory",
  async (input: ReserveInventoryInput, { container }) => {
    const inventoryModuleService = container.resolve(Modules.INVENTORY)

    const reservableItems = input.items.filter(
      (item): item is CheckoutLineItemSnapshot & { inventoryItemId: string } =>
        Boolean(item.inventoryItemId)
    )
    if (!reservableItems.length) {
      return new StepResponse<string[]>([], [])
    }

    const reservations = await inventoryModuleService.createReservationItems(
      reservableItems.map((item) => ({
        inventory_item_id: item.inventoryItemId,
        location_id: input.locationId,
        quantity: item.quantity,
      }))
    )
    const reservationIds = reservations.map((reservation) => reservation.id)
    return new StepResponse(reservationIds, reservationIds)
  },
  async (reservationIds, { container }) => {
    if (!reservationIds?.length) {
      return
    }
    const inventoryModuleService = container.resolve(Modules.INVENTORY)
    await inventoryModuleService.deleteReservationItems(reservationIds)
  }
)

type CreatePendingOrderInput = {
  customerId: string
  displayId: string
  currencyCode: string
  idempotencyKey: string
  shippingAddress: Record<string, unknown>
  lineItemsSnapshot: CheckoutLineItemSnapshot[]
  reservationItemIds: string[]
  subtotalAmount: number
  shippingAmount: number
  taxAmount: number
  taxRateBasisPoints: number
  totalAmount: number
  paymentRecipientName: string
  paymentRecipientPhone: string
}

const createPendingOrderStep = createStep(
  "create-pending-order",
  async (input: CreatePendingOrderInput, { container }) => {
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    const order = await orderModuleService.createMarketplaceOrders({
      display_id: input.displayId,
      customer_id: input.customerId,
      currency_code: input.currencyCode,
      status: "pending_payment",
      idempotency_key: input.idempotencyKey,
      subtotal_amount: input.subtotalAmount,
      shipping_amount: input.shippingAmount,
      tax_amount: input.taxAmount,
      tax_rate_basis_points: input.taxRateBasisPoints,
      total_amount: input.totalAmount,
      shipping_address: input.shippingAddress,
      // model.json() types as Record<string, unknown> - these two are
      // genuinely arrays, so a cast is needed at the write boundary (the
      // read side already casts back, see capture-checkout-payment.ts).
      line_items_snapshot: input.lineItemsSnapshot as unknown as Record<string, unknown>,
      reservation_item_ids: input.reservationItemIds as unknown as Record<string, unknown>,
      payment_status: "pending",
      payment_method: "manual_telebirr",
      payment_recipient_name: input.paymentRecipientName,
      payment_recipient_phone: input.paymentRecipientPhone,
    })
    return new StepResponse(order, order.id)
  },
  async (orderId, { container }) => {
    if (!orderId) {
      return
    }
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    await orderModuleService.deleteMarketplaceOrders([orderId])
  }
)

export type StartCheckoutWorkflowInput = {
  customerId: string
  displayId: string
  currencyCode: string
  idempotencyKey: string
  shippingAddress: Record<string, unknown>
  lineItemsSnapshot: CheckoutLineItemSnapshot[]
  locationId: string
  subtotalAmount: number
  shippingAmount: number
  taxAmount: number
  taxRateBasisPoints: number
  totalAmount: number
  paymentRecipientName: string
  paymentRecipientPhone: string
}

export const startCheckoutWorkflowId = "start-checkout"

export const startCheckoutWorkflow = createWorkflow(
  startCheckoutWorkflowId,
  (input: StartCheckoutWorkflowInput) => {
    const reservationItemIds = reserveInventoryStep({
      items: input.lineItemsSnapshot,
      locationId: input.locationId,
    })

    const order = createPendingOrderStep({
      customerId: input.customerId,
      displayId: input.displayId,
      currencyCode: input.currencyCode,
      idempotencyKey: input.idempotencyKey,
      shippingAddress: input.shippingAddress,
      lineItemsSnapshot: input.lineItemsSnapshot,
      reservationItemIds,
      subtotalAmount: input.subtotalAmount,
      shippingAmount: input.shippingAmount,
      taxAmount: input.taxAmount,
      taxRateBasisPoints: input.taxRateBasisPoints,
      totalAmount: input.totalAmount,
      paymentRecipientName: input.paymentRecipientName,
      paymentRecipientPhone: input.paymentRecipientPhone,
    })

    return new WorkflowResponse({
      orderId: order.id,
      displayId: order.display_id,
      paymentRecipientName: order.payment_recipient_name,
      paymentRecipientPhone: order.payment_recipient_phone,
    })
  }
)
