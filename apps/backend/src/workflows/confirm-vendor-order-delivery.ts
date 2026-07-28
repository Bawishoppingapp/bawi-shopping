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
    recordDeliveredAuditLogStep({ vendorOrderId: input.vendorOrderId, courierId: input.courierId })
    return new WorkflowResponse(vendorOrder)
  }
)
