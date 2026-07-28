import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_ORDER_MODULE } from "../modules/marketplace-order"
import type OrderModuleService from "../modules/marketplace-order/service"
import { SELLER_FINANCE_MODULE } from "../modules/seller-finance"
import type SellerFinanceModuleService from "../modules/seller-finance/service"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { createStripePaymentClient } from "../payments/stripe-payment-client"
import { getOrCreateDefaultStockLocationId } from "./shared/default-stock-location"
import { recordNotification } from "../notifications/record-notification"
import { refundProcessedTemplate } from "../notifications/templates"

/**
 * A customer cancels a vendor_order still in awaiting_preparation (the
 * cutoff - business-config `cancellation.cancellation_cutoff`, checked in
 * the route before this workflow runs). A full refund, a full commission
 * reversal, and a full inventory restoration (the final deduction already
 * happened at checkout capture, per docs/DECISIONS.md - this undoes it).
 */

type CancelVendorOrderInput = { vendorOrderId: string; customerId: string }

const restockVendorOrderStep = createStep(
  "restock-vendor-order",
  async (input: CancelVendorOrderInput, { container }) => {
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    const items = await orderModuleService.listVendorOrderItems({
      vendor_order_id: input.vendorOrderId,
    })
    const variantIds = items.map((item) => item.variant_id).filter((id): id is string => !!id)
    if (!variantIds.length) {
      return new StepResponse(true)
    }

    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: variants } = await query.graph({
      entity: "product_variant",
      fields: ["id", "inventory_items.inventory.id"],
      filters: { id: variantIds },
    })
    const inventoryItemByVariantId = new Map(
      (variants as Array<{ id: string; inventory_items?: Array<{ inventory?: { id?: string } }> }>).map(
        (variant) => [variant.id, variant.inventory_items?.[0]?.inventory?.id]
      )
    )

    const locationId = await getOrCreateDefaultStockLocationId(container)
    const adjustments = items
      .map((item) => ({
        inventoryItemId: item.variant_id ? inventoryItemByVariantId.get(item.variant_id) : undefined,
        quantity: item.quantity,
      }))
      .filter((entry): entry is { inventoryItemId: string; quantity: number } =>
        Boolean(entry.inventoryItemId)
      )

    if (adjustments.length) {
      const inventoryModuleService = container.resolve(Modules.INVENTORY)
      await inventoryModuleService.adjustInventory(
        adjustments.map((entry) => ({
          inventoryItemId: entry.inventoryItemId,
          locationId,
          adjustment: entry.quantity,
        }))
      )
    }
    return new StepResponse(true)
  }
)

type RefundVendorOrderInput = { vendorOrderId: string }
type RefundVendorOrderCompensation = { refundId: string | null; ledgerEntryId: string | null }

const refundCancelledVendorOrderStep = createStep(
  "refund-cancelled-vendor-order",
  async (input: RefundVendorOrderInput, { container }) => {
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )

    const vendorOrder = await orderModuleService.retrieveVendorOrder(input.vendorOrderId)
    const marketplaceOrder = await orderModuleService.retrieveMarketplaceOrder(vendorOrder.order_id)
    const [originalLedgerEntry] = await sellerFinanceModuleService.listCommissionLedgerEntries({
      vendor_order_id: input.vendorOrderId,
      reason: "order",
    })

    const paymentClient = createStripePaymentClient()
    let stripeRefundId: string | null = null
    if (marketplaceOrder.stripe_payment_intent_id && vendorOrder.total_amount > 0) {
      const refund = await paymentClient.createRefund({
        paymentIntentId: marketplaceOrder.stripe_payment_intent_id,
        amountCents: vendorOrder.total_amount,
        idempotencyKey: `cancel-${input.vendorOrderId}`,
        metadata: { vendor_order_id: input.vendorOrderId, reason: "cancellation" },
      })
      stripeRefundId = refund.id
    }

    const orderRefund = await sellerFinanceModuleService.createOrderRefunds({
      return_request_id: null,
      order_id: vendorOrder.order_id,
      vendor_order_id: input.vendorOrderId,
      amount: vendorOrder.total_amount,
      is_partial: false,
      stripe_refund_id: stripeRefundId,
      status: "succeeded",
    })

    let ledgerEntry: { id: string } | null = null
    if (originalLedgerEntry && originalLedgerEntry.net_amount !== 0) {
      ledgerEntry = await sellerFinanceModuleService.createCommissionLedgerEntries({
        vendor_order_id: input.vendorOrderId,
        vendor_id: vendorOrder.vendor_id,
        reason: "refund_reversal",
        commission_rate_basis_points: vendorOrder.commission_rate_basis_points,
        commission_amount: -vendorOrder.commission_amount,
        net_amount: -originalLedgerEntry.net_amount,
        transfer_hold_days_snapshot: 0,
        available_at: new Date(),
        reverses_entry_id: originalLedgerEntry.id,
      })
    }

    await orderModuleService.updateVendorOrders({
      id: input.vendorOrderId,
      status: "cancelled",
    })

    const compensation: RefundVendorOrderCompensation = {
      refundId: orderRefund.id,
      ledgerEntryId: ledgerEntry?.id ?? null,
    }
    return new StepResponse(orderRefund, compensation)
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    if (compensationInput.ledgerEntryId) {
      await sellerFinanceModuleService.deleteCommissionLedgerEntries([
        compensationInput.ledgerEntryId,
      ])
    }
    if (compensationInput.refundId) {
      await sellerFinanceModuleService.deleteOrderRefunds([compensationInput.refundId])
    }
  }
)

const recordCancelledAuditLogStep = createStep(
  "record-cancelled-audit-log",
  async (input: CancelVendorOrderInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "customer",
      actorId: input.customerId,
      action: "vendor_order.cancelled",
      entityType: "vendor_order",
      entityId: input.vendorOrderId,
      afterState: { status: "cancelled" },
    })
    return new StepResponse(auditLog)
  }
)

const sendCancellationRefundNotificationStep = createStep(
  "send-cancellation-refund-notification",
  async (input: { vendorOrderId: string; customerId: string }, { container }) => {
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    const customerModuleService = container.resolve(Modules.CUSTOMER)

    const [orderRefund] = await sellerFinanceModuleService.listOrderRefunds({
      vendor_order_id: input.vendorOrderId,
    })
    const customer = await customerModuleService.retrieveCustomer(input.customerId)
    if (!orderRefund || !customer.email) {
      return new StepResponse(null)
    }

    const { subject, body } = refundProcessedTemplate({ amount: orderRefund.amount })
    await recordNotification(container, {
      idempotencyKey: `refund_processed:${orderRefund.id}`,
      eventType: "refund_processed",
      to: customer.email,
      subject,
      body,
      recipientType: "customer",
      recipientId: input.customerId,
      resourceId: input.vendorOrderId,
      resourceType: "vendor_order",
    })
    return new StepResponse(null)
  }
)

export type CancelVendorOrderWorkflowInput = CancelVendorOrderInput

export const cancelVendorOrderWorkflowId = "cancel-vendor-order"

export const cancelVendorOrderWorkflow = createWorkflow(
  cancelVendorOrderWorkflowId,
  (input: CancelVendorOrderWorkflowInput) => {
    restockVendorOrderStep(input)
    const refund = refundCancelledVendorOrderStep({ vendorOrderId: input.vendorOrderId })
    recordCancelledAuditLogStep(input)
    sendCancellationRefundNotificationStep({
      vendorOrderId: input.vendorOrderId,
      customerId: input.customerId,
    })
    return new WorkflowResponse(refund)
  }
)

export { MedusaError }
