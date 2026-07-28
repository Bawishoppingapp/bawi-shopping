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

/** picked_up -> out_for_delivery - no code involved, just the assigned
 * courier confirming they're en route. */

type StartDeliveryInput = { vendorOrderId: string; courierId: string }
type StartDeliveryCompensation = { vendorOrderId: string }

const markOutForDeliveryStep = createStep(
  "mark-out-for-delivery",
  async (input: StartDeliveryInput, { container }) => {
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    const vendorOrder = await orderModuleService.updateVendorOrders({
      id: input.vendorOrderId,
      status: "out_for_delivery",
      out_for_delivery_at: new Date(),
    })
    const compensation: StartDeliveryCompensation = { vendorOrderId: input.vendorOrderId }
    return new StepResponse(vendorOrder, compensation)
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    await orderModuleService.updateVendorOrders({
      id: compensationInput.vendorOrderId,
      status: "picked_up",
      out_for_delivery_at: null,
    })
  }
)

const recordOutForDeliveryAuditLogStep = createStep(
  "record-out-for-delivery-audit-log",
  async (input: StartDeliveryInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "courier",
      actorId: input.courierId,
      action: "vendor_order.out_for_delivery",
      entityType: "vendor_order",
      entityId: input.vendorOrderId,
      afterState: { status: "out_for_delivery" },
    })
    return new StepResponse(auditLog)
  }
)

export type StartVendorOrderDeliveryWorkflowInput = StartDeliveryInput

export const startVendorOrderDeliveryWorkflowId = "start-vendor-order-delivery"

export const startVendorOrderDeliveryWorkflow = createWorkflow(
  startVendorOrderDeliveryWorkflowId,
  (input: StartVendorOrderDeliveryWorkflowInput) => {
    const vendorOrder = markOutForDeliveryStep(input)
    recordOutForDeliveryAuditLogStep(input)
    return new WorkflowResponse(vendorOrder)
  }
)
