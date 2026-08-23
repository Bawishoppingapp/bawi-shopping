import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
  when,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { WEBHOOK_EVENT_MODULE } from "../modules/webhook-event"
import type WebhookEventModuleService from "../modules/webhook-event/service"
import { MARKETPLACE_ORDER_MODULE } from "../modules/marketplace-order"
import type OrderModuleService from "../modules/marketplace-order/service"
import { BUSINESS_CONFIG_MODULE } from "../modules/business-config"
import type BusinessConfigModuleService from "../modules/business-config/service"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { resolveCommission } from "../orders/commission"
import { generateFulfillmentCode } from "../orders/fulfillment-code"
import { SELLER_FINANCE_MODULE } from "../modules/seller-finance"
import type SellerFinanceModuleService from "../modules/seller-finance/service"
import { recordNotification } from "../notifications/record-notification"
import { orderConfirmationTemplate } from "../notifications/templates"
import type { CheckoutLineItemSnapshot } from "./start-checkout"

/**
 * Runs once per successful `payment_intent.succeeded` webhook delivery -
 * idempotency-claim-first, same pattern as
 * apply-stripe-account-updated-webhook.ts. The per-vendor split, the final
 * inventory deduction, and clearing the cart all happen only after this
 * event is genuinely claimed for the first time (see docs/PAYMENTS.md §7).
 */

type ClaimEventInput = { eventId: string; eventType: string }

const claimWebhookEventStep = createStep(
  "claim-webhook-event",
  async (input: ClaimEventInput, { container }) => {
    const webhookEventModuleService: WebhookEventModuleService =
      container.resolve(WEBHOOK_EVENT_MODULE)
    const claimed = await webhookEventModuleService.markProcessed(
      "stripe",
      input.eventId,
      input.eventType
    )
    return new StepResponse(claimed, claimed ? input.eventId : null)
  },
  async (eventId, { container }) => {
    if (!eventId) {
      return
    }
    const webhookEventModuleService: WebhookEventModuleService =
      container.resolve(WEBHOOK_EVENT_MODULE)
    const [row] = await webhookEventModuleService.listProcessedWebhookEvents({
      provider: "stripe",
      event_id: eventId,
    })
    if (row) {
      await webhookEventModuleService.deleteProcessedWebhookEvents([row.id])
    }
  }
)

type MarkOrderPaidInput = { orderId: string }

const markOrderPaidStep = createStep(
  "mark-order-paid",
  async (input: MarkOrderPaidInput, { container }) => {
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    const order = await orderModuleService.updateMarketplaceOrders({
      id: input.orderId,
      status: "paid",
      payment_status: "succeeded",
    })
    return new StepResponse(order, input.orderId)
  },
  async (orderId, { container }) => {
    if (!orderId) {
      return
    }
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    await orderModuleService.updateMarketplaceOrders({
      id: orderId,
      status: "pending_payment",
      payment_status: "pending",
    })
  }
)

type SplitVendorOrdersInput = { orderId: string }
type SplitVendorOrdersCompensation = { vendorOrderIds: string[]; ledgerEntryIds: string[] }

function groupByVendor(
  items: CheckoutLineItemSnapshot[]
): Map<string, CheckoutLineItemSnapshot[]> {
  const groups = new Map<string, CheckoutLineItemSnapshot[]>()
  for (const item of items) {
    const existing = groups.get(item.vendorId)
    if (existing) {
      existing.push(item)
    } else {
      groups.set(item.vendorId, [item])
    }
  }
  return groups
}

/** Proportionally allocates an order-level total (shipping or tax) across
 * vendor groups by each group's share of the order subtotal, assigning any
 * rounding remainder to the last group so the parts always sum exactly to
 * the whole - there is no per-seller shipping/tax configuration yet (see
 * docs/DECISIONS.md), so an even split by item-value share is the
 * documented v1 approach. */
function allocateProportionally(
  totalCents: number,
  groupSubtotals: number[],
  orderSubtotal: number
): number[] {
  if (orderSubtotal <= 0 || !groupSubtotals.length) {
    return groupSubtotals.map(() => 0)
  }
  const allocations = groupSubtotals.map((subtotal) =>
    Math.floor((totalCents * subtotal) / orderSubtotal)
  )
  const allocated = allocations.reduce((sum, value) => sum + value, 0)
  allocations[allocations.length - 1] += totalCents - allocated
  return allocations
}

const splitIntoVendorOrdersStep = createStep(
  "split-into-vendor-orders",
  async (input: SplitVendorOrdersInput, { container }) => {
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    const businessConfigModuleService: BusinessConfigModuleService = container.resolve(
      BUSINESS_CONFIG_MODULE
    )
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )

    const order = await orderModuleService.retrieveMarketplaceOrder(input.orderId)
    const items = order.line_items_snapshot as unknown as CheckoutLineItemSnapshot[]
    const groups = groupByVendor(items)
    const vendorIds = Array.from(groups.keys())
    const groupSubtotals = vendorIds.map((vendorId) =>
      groups
        .get(vendorId)!
        .reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0)
    )

    const [commissionConfig, preparationConfig, transferTimingConfig] = await Promise.all([
      businessConfigModuleService.getCategoryValues("commission"),
      businessConfigModuleService.getCategoryValues("preparation"),
      businessConfigModuleService.getCategoryValues("transfer_timing"),
    ])
    const platformDefaultRate = Number(
      commissionConfig.platform_default_rate_basis_points ?? 1500
    )
    const prepDeadlineHours = Number(
      preparationConfig.seller_preparation_deadline_hours ?? 48
    )
    const fulfillmentDeadlineAt = new Date(Date.now() + prepDeadlineHours * 60 * 60 * 1000)
    // Snapshotted now, at order-creation time, so a later change to this
    // business-config value never retroactively alters an order already
    // in flight (see docs/PAYMENTS.md §5, docs/DECISIONS.md).
    const transferHoldDaysSnapshot = Number(transferTimingConfig.transfer_hold_days ?? 7)

    const shippingAllocations = allocateProportionally(
      order.shipping_amount,
      groupSubtotals,
      order.subtotal_amount
    )
    const taxAllocations = allocateProportionally(
      order.tax_amount,
      groupSubtotals,
      order.subtotal_amount
    )

    const vendorOrderIds: string[] = []
    const ledgerEntryIds: string[] = []

    for (let i = 0; i < vendorIds.length; i++) {
      const vendorId = vendorIds[i]
      const groupItems = groups.get(vendorId)!
      const subtotal = groupSubtotals[i]
      const shippingShare = shippingAllocations[i]
      const taxShare = taxAllocations[i]
      const { commission_rate_basis_points, commission_amount } = resolveCommission(
        subtotal,
        platformDefaultRate
      )

      const vendorOrder = await orderModuleService.createVendorOrders({
        order_id: input.orderId,
        vendor_id: vendorId,
        status: "awaiting_preparation",
        subtotal_amount: subtotal,
        shipping_amount: shippingShare,
        tax_amount: taxShare,
        commission_rate_basis_points,
        commission_amount,
        total_amount: subtotal + shippingShare + taxShare,
        fulfillment_code: generateFulfillmentCode(),
        fulfillment_deadline_at: fulfillmentDeadlineAt,
      })
      vendorOrderIds.push(vendorOrder.id)

      await orderModuleService.createVendorOrderItems(
        groupItems.map((item) => ({
          vendor_order_id: vendorOrder.id,
          vendor_id: vendorId,
          variant_id: item.variantId,
          product_id: item.productId,
          product_code: item.productCode,
          title: item.title,
          thumbnail: item.thumbnail,
          color: item.color,
          size: item.size,
          unit_price_amount: item.unitPriceCents,
          quantity: item.quantity,
          line_total_amount: item.unitPriceCents * item.quantity,
        }))
      )

      // Shipping/tax are Bawi's own revenue (Bawi operates fulfillment
      // and delivery, not the seller) - only the item subtotal, net of
      // commission, moves the seller's balance. See docs/DECISIONS.md.
      const netAmount = subtotal - commission_amount
      const ledgerEntry = await sellerFinanceModuleService.createCommissionLedgerEntries({
        vendor_order_id: vendorOrder.id,
        vendor_id: vendorId,
        // MarketplaceOrder.currency_code is a plain text column (it
        // predates the seller-currency enum and stays free-text so a
        // future third currency needs no migration there), but its value
        // is always constrained transitively via Seller.currency_code -
        // see cart-session.ts/cart-catalog.ts.
        currency_code: order.currency_code as "usd" | "etb",
        reason: "order",
        commission_rate_basis_points,
        commission_amount,
        net_amount: netAmount,
        transfer_hold_days_snapshot: transferHoldDaysSnapshot,
      })
      ledgerEntryIds.push(ledgerEntry.id)
    }

    const compensation: SplitVendorOrdersCompensation = { vendorOrderIds, ledgerEntryIds }
    return new StepResponse(vendorOrderIds, compensation)
  },
  async (compensationInput, { container }) => {
    if (!compensationInput?.vendorOrderIds.length) {
      return
    }
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    const items = await orderModuleService.listVendorOrderItems({
      vendor_order_id: compensationInput.vendorOrderIds,
    })
    if (items.length) {
      await orderModuleService.deleteVendorOrderItems(items.map((item) => item.id))
    }
    if (compensationInput.ledgerEntryIds.length) {
      await sellerFinanceModuleService.deleteCommissionLedgerEntries(
        compensationInput.ledgerEntryIds
      )
    }
    await orderModuleService.deleteVendorOrders(compensationInput.vendorOrderIds)
  }
)

type FinalizeInventoryInput = {
  reservationItemIds: string[]
  items: CheckoutLineItemSnapshot[]
  locationId: string
}

const finalizeInventoryStep = createStep(
  "finalize-inventory",
  async (input: FinalizeInventoryInput, { container }) => {
    const inventoryModuleService = container.resolve(Modules.INVENTORY)

    if (input.reservationItemIds.length) {
      await inventoryModuleService.deleteReservationItems(input.reservationItemIds)
    }

    const adjustable = input.items.filter((item) => item.inventoryItemId)
    if (adjustable.length) {
      await inventoryModuleService.adjustInventory(
        adjustable.map((item) => ({
          inventoryItemId: item.inventoryItemId as string,
          locationId: input.locationId,
          adjustment: -item.quantity,
        }))
      )
    }

    return new StepResponse(true, { items: adjustable, locationId: input.locationId })
  },
  async (compensationInput, { container }) => {
    if (!compensationInput?.items.length) {
      return
    }
    const inventoryModuleService = container.resolve(Modules.INVENTORY)
    // Best-effort restoration - undoing a final deduction after a later
    // step failed is rare and, per docs/DECISIONS.md's precedent for
    // similarly narrow residual risks, surfaced for manual reconciliation
    // rather than blocking rollback if it can't complete cleanly.
    await inventoryModuleService.adjustInventory(
      compensationInput.items.map((item) => ({
        inventoryItemId: item.inventoryItemId as string,
        locationId: compensationInput.locationId,
        adjustment: item.quantity,
      }))
    )
  }
)

type ClearCustomerCartInput = { customerId: string }

const clearCustomerCartStep = createStep(
  "clear-customer-cart",
  async (input: ClearCustomerCartInput, { container }) => {
    const cartModuleService = container.resolve(Modules.CART)
    const [cart] = await cartModuleService.listCarts(
      { customer_id: input.customerId },
      { relations: ["items"], order: { updated_at: "DESC" }, take: 1 }
    )
    if (!cart?.items?.length) {
      return new StepResponse(true)
    }
    await cartModuleService.deleteLineItems(cart.items.map((item) => item.id))
    return new StepResponse(true)
  }
)

type RecordAuditLogInput = { orderId: string; customerId: string }

const recordOrderPaidAuditLogStep = createStep(
  "record-order-paid-audit-log",
  async (input: RecordAuditLogInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "customer",
      actorId: input.customerId,
      action: "order.paid",
      entityType: "order",
      entityId: input.orderId,
      afterState: { status: "paid" },
    })
    return new StepResponse(auditLog)
  }
)

type SendOrderConfirmationInput = { orderId: string; customerId: string }

const sendOrderConfirmationStep = createStep(
  "send-order-confirmation",
  async (input: SendOrderConfirmationInput, { container }) => {
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    const customerModuleService = container.resolve(Modules.CUSTOMER)
    const order = await orderModuleService.retrieveMarketplaceOrder(input.orderId)
    const customer = await customerModuleService.retrieveCustomer(input.customerId)
    if (!customer.email) {
      return new StepResponse(null)
    }

    const { subject, body } = orderConfirmationTemplate({
      displayId: order.display_id,
      total: order.total_amount,
    })
    await recordNotification(container, {
      idempotencyKey: `order_confirmation:${input.orderId}`,
      eventType: "order_confirmation",
      to: customer.email,
      subject,
      body,
      recipientType: "customer",
      recipientId: input.customerId,
      resourceId: input.orderId,
      resourceType: "order",
    })
    return new StepResponse(null)
  }
)

export type CaptureCheckoutPaymentWorkflowInput = {
  eventId: string
  eventType: string
  orderId: string
  customerId: string
  reservationItemIds: string[]
  lineItemsSnapshot: CheckoutLineItemSnapshot[]
  locationId: string
}

export const captureCheckoutPaymentWorkflowId = "capture-checkout-payment"

export const captureCheckoutPaymentWorkflow = createWorkflow(
  captureCheckoutPaymentWorkflowId,
  (input: CaptureCheckoutPaymentWorkflowInput) => {
    const claimed = claimWebhookEventStep({
      eventId: input.eventId,
      eventType: input.eventType,
    })

    when({ claimed }, ({ claimed }) => claimed).then(() => {
      markOrderPaidStep({ orderId: input.orderId })

      splitIntoVendorOrdersStep({ orderId: input.orderId })

      finalizeInventoryStep({
        reservationItemIds: input.reservationItemIds,
        items: input.lineItemsSnapshot,
        locationId: input.locationId,
      })

      clearCustomerCartStep({ customerId: input.customerId })

      recordOrderPaidAuditLogStep({
        orderId: input.orderId,
        customerId: input.customerId,
      })

      sendOrderConfirmationStep({
        orderId: input.orderId,
        customerId: input.customerId,
      })
    })

    return new WorkflowResponse({ claimed })
  }
)
