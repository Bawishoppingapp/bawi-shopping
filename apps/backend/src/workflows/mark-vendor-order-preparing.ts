import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MARKETPLACE_ORDER_MODULE } from "../modules/marketplace-order"
import type OrderModuleService from "../modules/marketplace-order/service"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"

/**
 * The seller's own first fulfillment action: awaiting_preparation ->
 * preparing. A plain status/timestamp write plus an audit log entry - no
 * external side effect, so a light two-step workflow (matching
 * connect-seller-stripe-account.ts's granularity) is enough.
 */

type MarkPreparingInput = { vendorOrderId: string; sellerUserId: string }
type MarkPreparingCompensation = { vendorOrderId: string }

const markPreparingStep = createStep(
  "mark-preparing",
  async (input: MarkPreparingInput, { container }) => {
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    const vendorOrder = await orderModuleService.updateVendorOrders({
      id: input.vendorOrderId,
      status: "preparing",
      preparing_at: new Date(),
    })
    const compensation: MarkPreparingCompensation = { vendorOrderId: input.vendorOrderId }
    return new StepResponse(vendorOrder, compensation)
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    await orderModuleService.updateVendorOrders({
      id: compensationInput.vendorOrderId,
      status: "awaiting_preparation",
      preparing_at: null,
    })
  }
)

const recordPreparingAuditLogStep = createStep(
  "record-preparing-audit-log",
  async (input: MarkPreparingInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "seller_user",
      actorId: input.sellerUserId,
      action: "vendor_order.preparing",
      entityType: "vendor_order",
      entityId: input.vendorOrderId,
      afterState: { status: "preparing" },
    })
    return new StepResponse(auditLog)
  }
)

export type MarkVendorOrderPreparingWorkflowInput = MarkPreparingInput

export const markVendorOrderPreparingWorkflowId = "mark-preparing"

export const markVendorOrderPreparingWorkflow = createWorkflow(
  markVendorOrderPreparingWorkflowId,
  (input: MarkVendorOrderPreparingWorkflowInput) => {
    const vendorOrder = markPreparingStep(input)
    recordPreparingAuditLogStep(input)
    return new WorkflowResponse(vendorOrder)
  }
)
