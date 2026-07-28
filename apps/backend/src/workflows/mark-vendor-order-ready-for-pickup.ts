import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MARKETPLACE_ORDER_MODULE } from "../modules/marketplace-order"
import type OrderModuleService from "../modules/marketplace-order/service"
import { FULFILLMENT_PRIVACY_MODULE } from "../modules/fulfillment-privacy"
import type FulfillmentPrivacyModuleService from "../modules/fulfillment-privacy/service"
import { generatePrivacyCode, PRIVACY_CODE_TTL_MS } from "../modules/fulfillment-privacy/utils"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"

/**
 * preparing -> ready_for_pickup, and the point where both the pickup code
 * (courier-facing, consumed at pickup) and tracking code (customer-facing,
 * consumed at delivery) are minted together - see
 * docs/DECISIONS.md and the model comments in
 * src/modules/fulfillment-privacy/models/. Issuing both codes is itself an
 * audited event per docs/SECURITY.md §11 ("all issuance/consumption... is
 * audit-logged"), separate from the status-change audit entry.
 */

type CreateCodesInput = { vendorOrderId: string }
type CreateCodesCompensation = { pickupCodeId: string; trackingCodeId: string }

const createPickupAndTrackingCodesStep = createStep(
  "create-pickup-and-tracking-codes",
  async (input: CreateCodesInput, { container }) => {
    const fulfillmentPrivacyModuleService: FulfillmentPrivacyModuleService = container.resolve(
      FULFILLMENT_PRIVACY_MODULE
    )
    const expiresAt = new Date(Date.now() + PRIVACY_CODE_TTL_MS)

    const pickupCode = await fulfillmentPrivacyModuleService.createPickupCodes({
      vendor_order_id: input.vendorOrderId,
      code: generatePrivacyCode(),
      expires_at: expiresAt,
    })
    const trackingCode = await fulfillmentPrivacyModuleService.createTrackingCodes({
      vendor_order_id: input.vendorOrderId,
      code: generatePrivacyCode(),
      expires_at: expiresAt,
    })

    const compensation: CreateCodesCompensation = {
      pickupCodeId: pickupCode.id,
      trackingCodeId: trackingCode.id,
    }
    return new StepResponse({ pickupCode, trackingCode }, compensation)
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const fulfillmentPrivacyModuleService: FulfillmentPrivacyModuleService = container.resolve(
      FULFILLMENT_PRIVACY_MODULE
    )
    await fulfillmentPrivacyModuleService.deletePickupCodes([compensationInput.pickupCodeId])
    await fulfillmentPrivacyModuleService.deleteTrackingCodes([compensationInput.trackingCodeId])
  }
)

type MarkReadyInput = { vendorOrderId: string; sellerUserId: string }
type MarkReadyCompensation = { vendorOrderId: string }

const markReadyForPickupStep = createStep(
  "mark-ready-for-pickup",
  async (input: MarkReadyInput, { container }) => {
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    const vendorOrder = await orderModuleService.updateVendorOrders({
      id: input.vendorOrderId,
      status: "ready_for_pickup",
      ready_for_pickup_at: new Date(),
    })
    const compensation: MarkReadyCompensation = { vendorOrderId: input.vendorOrderId }
    return new StepResponse(vendorOrder, compensation)
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    await orderModuleService.updateVendorOrders({
      id: compensationInput.vendorOrderId,
      status: "preparing",
      ready_for_pickup_at: null,
    })
  }
)

const recordReadyForPickupAuditLogStep = createStep(
  "record-ready-for-pickup-audit-log",
  async (input: MarkReadyInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "seller_user",
      actorId: input.sellerUserId,
      action: "vendor_order.ready_for_pickup",
      entityType: "vendor_order",
      entityId: input.vendorOrderId,
      afterState: { status: "ready_for_pickup" },
    })
    return new StepResponse(auditLog)
  }
)

const recordCodesIssuedAuditLogStep = createStep(
  "record-codes-issued-audit-log",
  async (input: MarkReadyInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "seller_user",
      actorId: input.sellerUserId,
      action: "vendor_order.pickup_and_tracking_codes_issued",
      entityType: "vendor_order",
      entityId: input.vendorOrderId,
    })
    return new StepResponse(auditLog)
  }
)

export type MarkVendorOrderReadyForPickupWorkflowInput = MarkReadyInput

export const markVendorOrderReadyForPickupWorkflowId = "mark-ready-for-pickup"

export const markVendorOrderReadyForPickupWorkflow = createWorkflow(
  markVendorOrderReadyForPickupWorkflowId,
  (input: MarkVendorOrderReadyForPickupWorkflowInput) => {
    const codes = createPickupAndTrackingCodesStep({ vendorOrderId: input.vendorOrderId })
    const vendorOrder = markReadyForPickupStep(input)
    recordReadyForPickupAuditLogStep(input)
    recordCodesIssuedAuditLogStep(input)
    return new WorkflowResponse({ vendorOrder, codes })
  }
)
