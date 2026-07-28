import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { MARKETPLACE_ORDER_MODULE } from "../modules/marketplace-order"
import type OrderModuleService from "../modules/marketplace-order/service"
import { FULFILLMENT_PRIVACY_MODULE } from "../modules/fulfillment-privacy"
import type FulfillmentPrivacyModuleService from "../modules/fulfillment-privacy/service"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { SELLER_FINANCE_MODULE } from "../modules/seller-finance"
import type SellerFinanceModuleService from "../modules/seller-finance/service"

/**
 * Proof of delivery: the courier submits the tracking/delivery code the
 * *customer* provided at the door (never shown to the courier in advance -
 * see docs/DECISIONS.md). Same single-use claim discipline as
 * confirm-vendor-order-pickup.ts.
 */

type RedeemTrackingCodeInput = { vendorOrderId: string; submittedCode: string; courierId: string }
type RedeemTrackingCodeCompensation = { redemptionCreated: boolean; codeId: string }

const redeemTrackingCodeStep = createStep(
  "redeem-tracking-code",
  async (input: RedeemTrackingCodeInput, { container }) => {
    const fulfillmentPrivacyModuleService: FulfillmentPrivacyModuleService = container.resolve(
      FULFILLMENT_PRIVACY_MODULE
    )

    const [trackingCode] = await fulfillmentPrivacyModuleService.listTrackingCodes({
      vendor_order_id: input.vendorOrderId,
      code: input.submittedCode,
    })
    if (!trackingCode || trackingCode.expires_at.getTime() < Date.now()) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid or expired delivery code")
    }

    const claimed = await fulfillmentPrivacyModuleService.redeemCode(
      "tracking",
      trackingCode.id,
      input.courierId
    )
    if (!claimed) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "This delivery code has already been used")
    }

    const compensation: RedeemTrackingCodeCompensation = {
      redemptionCreated: true,
      codeId: trackingCode.id,
    }
    return new StepResponse(trackingCode, compensation)
  },
  async (compensationInput, { container }) => {
    if (!compensationInput?.redemptionCreated) {
      return
    }
    const fulfillmentPrivacyModuleService: FulfillmentPrivacyModuleService = container.resolve(
      FULFILLMENT_PRIVACY_MODULE
    )
    const [redemption] = await fulfillmentPrivacyModuleService.listFulfillmentCodeRedemptions({
      code_id: compensationInput.codeId,
    })
    if (redemption) {
      await fulfillmentPrivacyModuleService.deleteFulfillmentCodeRedemptions([redemption.id])
    }
  }
)

type MarkDeliveredInput = { vendorOrderId: string }
type MarkDeliveredCompensation = { vendorOrderId: string }

const markDeliveredStep = createStep(
  "mark-delivered",
  async (input: MarkDeliveredInput, { container }) => {
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    const vendorOrder = await orderModuleService.updateVendorOrders({
      id: input.vendorOrderId,
      status: "delivered",
      delivered_at: new Date(),
    })
    const compensation: MarkDeliveredCompensation = { vendorOrderId: input.vendorOrderId }
    return new StepResponse(vendorOrder, compensation)
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    await orderModuleService.updateVendorOrders({
      id: compensationInput.vendorOrderId,
      status: "out_for_delivery",
      delivered_at: null,
    })
  }
)

type MakeLedgerEntryAvailableInput = { vendorOrderId: string }
type MakeLedgerEntryAvailableCompensation = { ledgerEntryId: string }

/**
 * Delivery is what starts the transfer-hold clock - `available_at` is
 * computed here (delivered_at + the entry's own *snapshotted*
 * transfer_hold_days, never re-read live from business-config) rather
 * than at ledger-entry-creation time, since delivery hadn't happened yet
 * back then. See docs/PAYMENTS.md §5, docs/DECISIONS.md.
 */
const makeLedgerEntryAvailableStep = createStep(
  "make-ledger-entry-available",
  async (input: MakeLedgerEntryAvailableInput, { container }) => {
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    const [entry] = await sellerFinanceModuleService.listCommissionLedgerEntries({
      vendor_order_id: input.vendorOrderId,
      reason: "order",
    })
    if (!entry) {
      return new StepResponse(null, null)
    }

    const availableAt = new Date(
      Date.now() + entry.transfer_hold_days_snapshot * 24 * 60 * 60 * 1000
    )
    await sellerFinanceModuleService.updateCommissionLedgerEntries({
      id: entry.id,
      available_at: availableAt,
    })

    const compensation: MakeLedgerEntryAvailableCompensation = { ledgerEntryId: entry.id }
    return new StepResponse(entry, compensation)
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    await sellerFinanceModuleService.updateCommissionLedgerEntries({
      id: compensationInput.ledgerEntryId,
      available_at: null,
    })
  }
)

const recordDeliveredAuditLogStep = createStep(
  "record-delivered-audit-log",
  async (input: { vendorOrderId: string; courierId: string }, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "courier",
      actorId: input.courierId,
      action: "vendor_order.delivered",
      entityType: "vendor_order",
      entityId: input.vendorOrderId,
      afterState: { status: "delivered" },
    })
    return new StepResponse(auditLog)
  }
)

export type ConfirmVendorOrderDeliveryWorkflowInput = RedeemTrackingCodeInput

export const confirmVendorOrderDeliveryWorkflowId = "confirm-vendor-order-delivery"

export const confirmVendorOrderDeliveryWorkflow = createWorkflow(
  confirmVendorOrderDeliveryWorkflowId,
  (input: ConfirmVendorOrderDeliveryWorkflowInput) => {
    redeemTrackingCodeStep(input)
    const vendorOrder = markDeliveredStep({ vendorOrderId: input.vendorOrderId })
    makeLedgerEntryAvailableStep({ vendorOrderId: input.vendorOrderId })
    recordDeliveredAuditLogStep({ vendorOrderId: input.vendorOrderId, courierId: input.courierId })
    return new WorkflowResponse(vendorOrder)
  }
)
