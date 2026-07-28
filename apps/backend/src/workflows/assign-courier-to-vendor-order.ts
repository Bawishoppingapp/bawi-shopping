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

/** Admin assigns a courier to a ready-for-pickup vendor order. No real
 * courier-booking integration exists yet (business-config `courier`
 * category, `real_courier_booking_enabled: false` - see docs/DECISIONS.md),
 * so this is a manual admin action, not automatic dispatch. */

type AssignCourierInput = { vendorOrderId: string; courierId: string; adminUserId: string }
type AssignCourierCompensation = { vendorOrderId: string; previousCourierId: string | null }

const assignCourierStep = createStep(
  "assign-courier",
  async (input: AssignCourierInput, { container }) => {
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    const previous = await orderModuleService.retrieveVendorOrder(input.vendorOrderId)

    const vendorOrder = await orderModuleService.updateVendorOrders({
      id: input.vendorOrderId,
      assigned_courier_id: input.courierId,
    })

    const compensation: AssignCourierCompensation = {
      vendorOrderId: input.vendorOrderId,
      previousCourierId: previous.assigned_courier_id,
    }
    return new StepResponse(vendorOrder, compensation)
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    await orderModuleService.updateVendorOrders({
      id: compensationInput.vendorOrderId,
      assigned_courier_id: compensationInput.previousCourierId,
    })
  }
)

const recordCourierAssignedAuditLogStep = createStep(
  "record-courier-assigned-audit-log",
  async (input: AssignCourierInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "user",
      actorId: input.adminUserId,
      action: "vendor_order.courier_assigned",
      entityType: "vendor_order",
      entityId: input.vendorOrderId,
      afterState: { assigned_courier_id: input.courierId },
    })
    return new StepResponse(auditLog)
  }
)

export type AssignCourierToVendorOrderWorkflowInput = AssignCourierInput

export const assignCourierToVendorOrderWorkflowId = "assign-courier"

export const assignCourierToVendorOrderWorkflow = createWorkflow(
  assignCourierToVendorOrderWorkflowId,
  (input: AssignCourierToVendorOrderWorkflowInput) => {
    const vendorOrder = assignCourierStep(input)
    recordCourierAssignedAuditLogStep(input)
    return new WorkflowResponse(vendorOrder)
  }
)
