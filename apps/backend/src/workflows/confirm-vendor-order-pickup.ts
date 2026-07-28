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
 * The courier submits the pickup code shown/printed by the seller. Single
 * use is enforced by FulfillmentCodeRedemption's unique-index claim (see
 * docs/DECISIONS.md), not by this step re-checking a status flag - a
 * genuinely reused or expired code is rejected here regardless of any
 * other state.
 */

type RedeemPickupCodeInput = { vendorOrderId: string; submittedCode: string; courierId: string }
type RedeemPickupCodeCompensation = { redemptionCreated: boolean; codeId: string }

const redeemPickupCodeStep = createStep(
  "redeem-pickup-code",
  async (input: RedeemPickupCodeInput, { container }) => {
    const fulfillmentPrivacyModuleService: FulfillmentPrivacyModuleService = container.resolve(
      FULFILLMENT_PRIVACY_MODULE
    )

    const [pickupCode] = await fulfillmentPrivacyModuleService.listPickupCodes({
      vendor_order_id: input.vendorOrderId,
      code: input.submittedCode,
    })
    if (!pickupCode || pickupCode.expires_at.getTime() < Date.now()) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid or expired pickup code")
    }

    const claimed = await fulfillmentPrivacyModuleService.redeemCode(
      "pickup",
      pickupCode.id,
      input.courierId
    )
    if (!claimed) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "This pickup code has already been used")
    }

    const compensation: RedeemPickupCodeCompensation = { redemptionCreated: true, codeId: pickupCode.id }
    return new StepResponse(pickupCode, compensation)
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

type MarkPickedUpInput = { vendorOrderId: string }
type MarkPickedUpCompensation = { vendorOrderId: string }

const markPickedUpStep = createStep(
  "mark-picked-up",
  async (input: MarkPickedUpInput, { container }) => {
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    const vendorOrder = await orderModuleService.updateVendorOrders({
      id: input.vendorOrderId,
      status: "picked_up",
      picked_up_at: new Date(),
    })
    const compensation: MarkPickedUpCompensation = { vendorOrderId: input.vendorOrderId }
    return new StepResponse(vendorOrder, compensation)
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    await orderModuleService.updateVendorOrders({
      id: compensationInput.vendorOrderId,
      status: "ready_for_pickup",
      picked_up_at: null,
    })
  }
)

const recordPickedUpAuditLogStep = createStep(
  "record-picked-up-audit-log",
  async (input: { vendorOrderId: string; courierId: string }, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "courier",
      actorId: input.courierId,
      action: "vendor_order.picked_up",
      entityType: "vendor_order",
      entityId: input.vendorOrderId,
      afterState: { status: "picked_up" },
    })
    return new StepResponse(auditLog)
  }
)

export type ConfirmVendorOrderPickupWorkflowInput = RedeemPickupCodeInput

export const confirmVendorOrderPickupWorkflowId = "confirm-vendor-order-pickup"

export const confirmVendorOrderPickupWorkflow = createWorkflow(
  confirmVendorOrderPickupWorkflowId,
  (input: ConfirmVendorOrderPickupWorkflowInput) => {
    redeemPickupCodeStep(input)
    const vendorOrder = markPickedUpStep({ vendorOrderId: input.vendorOrderId })
    recordPickedUpAuditLogStep({ vendorOrderId: input.vendorOrderId, courierId: input.courierId })
    return new WorkflowResponse(vendorOrder)
  }
)
