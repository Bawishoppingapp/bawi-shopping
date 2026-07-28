import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { SELLER_FINANCE_MODULE } from "../modules/seller-finance"
import type SellerFinanceModuleService from "../modules/seller-finance/service"
import { MARKETPLACE_ORDER_MODULE } from "../modules/marketplace-order"
import type OrderModuleService from "../modules/marketplace-order/service"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { createStripePaymentClient } from "../payments/stripe-payment-client"
import { calculateRefund } from "../finance/refund-calculation"
import { getOrCreateDefaultStockLocationId } from "./shared/default-stock-location"

/**
 * Approving a return request is what triggers the actual refund: a Stripe
 * refund against the order's original PaymentIntent, a proportional
 * commission reversal (docs/PAYMENTS.md §6), and inventory restoration
 * for restockable reasons (not damaged/defective - see docs/DECISIONS.md).
 * The refund amount always comes from stored item/order data, capped by
 * the item's own line_total - never a client-supplied figure.
 */

type MarkApprovedInput = { returnRequestId: string; reviewerId: string; reviewerType: "seller_user" | "user" }

const markApprovedStep = createStep(
  "mark-approved",
  async (input: MarkApprovedInput, { container }) => {
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    const returnRequest = await sellerFinanceModuleService.updateReturnRequests({
      id: input.returnRequestId,
      status: "approved",
      reviewed_by: input.reviewerId,
      reviewed_at: new Date(),
    })
    return new StepResponse(returnRequest, input.returnRequestId)
  },
  async (returnRequestId, { container }) => {
    if (!returnRequestId) {
      return
    }
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    await sellerFinanceModuleService.updateReturnRequests({
      id: returnRequestId,
      status: "requested",
      reviewed_by: null,
      reviewed_at: null,
    })
  }
)

type ProcessRefundInput = { returnRequestId: string; requestedAmount?: number }
type ProcessRefundCompensation = { refundId: string | null; ledgerEntryId: string | null }

const processRefundStep = createStep(
  "process-refund",
  async (input: ProcessRefundInput, { container }) => {
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)

    const returnRequest = await sellerFinanceModuleService.retrieveReturnRequest(
      input.returnRequestId
    )
    const vendorOrderItem = await orderModuleService.retrieveVendorOrderItem(
      returnRequest.vendor_order_item_id
    )
    const vendorOrder = await orderModuleService.retrieveVendorOrder(returnRequest.vendor_order_id)
    const marketplaceOrder = await orderModuleService.retrieveMarketplaceOrder(
      returnRequest.order_id
    )
    const [originalLedgerEntry] = await sellerFinanceModuleService.listCommissionLedgerEntries({
      vendor_order_id: returnRequest.vendor_order_id,
      reason: "order",
    })

    const itemCommissionShare =
      vendorOrder.subtotal_amount > 0
        ? Math.round(
            (vendorOrder.commission_amount * vendorOrderItem.line_total_amount) /
              vendorOrder.subtotal_amount
          )
        : 0

    const calculation = calculateRefund(
      vendorOrderItem.line_total_amount,
      itemCommissionShare,
      input.requestedAmount
    )

    const paymentClient = createStripePaymentClient()
    const idempotencyKey = `refund-${returnRequest.id}`
    let stripeRefundId: string | null = null
    if (marketplaceOrder.stripe_payment_intent_id && calculation.refund_amount > 0) {
      const refund = await paymentClient.createRefund({
        paymentIntentId: marketplaceOrder.stripe_payment_intent_id,
        amountCents: calculation.refund_amount,
        idempotencyKey,
        metadata: { return_request_id: returnRequest.id },
      })
      stripeRefundId = refund.id
    }

    const orderRefund = await sellerFinanceModuleService.createOrderRefunds({
      return_request_id: returnRequest.id,
      order_id: returnRequest.order_id,
      vendor_order_id: returnRequest.vendor_order_id,
      amount: calculation.refund_amount,
      is_partial: calculation.is_partial,
      stripe_refund_id: stripeRefundId,
      status: "succeeded",
    })

    let ledgerEntry: { id: string } | null = null
    if (calculation.net_reversal_amount !== 0) {
      ledgerEntry = await sellerFinanceModuleService.createCommissionLedgerEntries({
        vendor_order_id: returnRequest.vendor_order_id,
        vendor_id: returnRequest.vendor_id,
        reason: "refund_reversal",
        commission_rate_basis_points: vendorOrder.commission_rate_basis_points,
        commission_amount: -calculation.commission_reversal_amount,
        net_amount: -calculation.net_reversal_amount,
        transfer_hold_days_snapshot: 0,
        // A reversal is immediately certain - it nets against whichever
        // bucket the original entry sits in right away, not subject to a
        // fresh hold period (see docs/PAYMENTS.md §6).
        available_at: new Date(),
        reverses_entry_id: originalLedgerEntry?.id ?? null,
      })
    }

    // Damaged/defective items are not restocked (unsellable); incorrect
    // shipments and customer-remorse returns are, since the item itself
    // is presumably still sellable - see docs/DECISIONS.md.
    let restocked = false
    if (
      (returnRequest.reason === "incorrect" || returnRequest.reason === "customer_remorse") &&
      vendorOrderItem.variant_id
    ) {
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: variants } = await query.graph({
        entity: "product_variant",
        fields: ["id", "inventory_items.inventory.id"],
        filters: { id: [vendorOrderItem.variant_id] },
      })
      const inventoryItemId = (
        variants[0]?.inventory_items as Array<{ inventory?: { id?: string } }> | undefined
      )?.[0]?.inventory?.id
      if (inventoryItemId) {
        const inventoryModuleService = container.resolve(Modules.INVENTORY)
        const locationId = await getOrCreateDefaultStockLocationId(container)
        await inventoryModuleService.adjustInventory([
          {
            inventoryItemId,
            locationId,
            adjustment: vendorOrderItem.quantity,
          },
        ])
        restocked = true
      }
    }

    await sellerFinanceModuleService.updateReturnRequests({
      id: returnRequest.id,
      status: "refunded",
    })

    const compensation: ProcessRefundCompensation = {
      refundId: orderRefund.id,
      ledgerEntryId: ledgerEntry?.id ?? null,
    }
    return new StepResponse({ orderRefund, restocked }, compensation)
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
    // Inventory restock and the real Stripe refund are not reversed here -
    // same "best-effort, surfaced for manual reconciliation" precedent as
    // docs/DECISIONS.md's other narrow residual risks; a failed later step
    // after a real refund/restock already happened is rare and financially
    // in the customer/platform's favor, not a security issue.
  }
)

type RecordAuditLogInput = {
  returnRequestId: string
  reviewerId: string
  reviewerType: "seller_user" | "user"
  refundAmount: number
}

const recordApprovedAuditLogStep = createStep(
  "record-approved-audit-log",
  async (input: RecordAuditLogInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: input.reviewerType,
      actorId: input.reviewerId,
      action: "return_request.approved_and_refunded",
      entityType: "return_request",
      entityId: input.returnRequestId,
      afterState: { status: "refunded", refund_amount: input.refundAmount },
    })
    return new StepResponse(auditLog)
  }
)

export type ApproveReturnRequestWorkflowInput = MarkApprovedInput & { requestedAmount?: number }

export const approveReturnRequestWorkflowId = "approve-return-request"

export const approveReturnRequestWorkflow = createWorkflow(
  approveReturnRequestWorkflowId,
  (input: ApproveReturnRequestWorkflowInput) => {
    markApprovedStep(input)

    const result = processRefundStep({
      returnRequestId: input.returnRequestId,
      requestedAmount: input.requestedAmount,
    })

    recordApprovedAuditLogStep({
      returnRequestId: input.returnRequestId,
      reviewerId: input.reviewerId,
      reviewerType: input.reviewerType,
      refundAmount: result.orderRefund.amount,
    })

    return new WorkflowResponse(result)
  }
)
