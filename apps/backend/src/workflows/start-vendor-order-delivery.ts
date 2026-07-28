import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { MARKETPLACE_ORDER_MODULE } from "../modules/marketplace-order"
import type OrderModuleService from "../modules/marketplace-order/service"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { recordNotification } from "../notifications/record-notification"
import { shipmentUpdateTemplate } from "../notifications/templates"

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

const sendShipmentUpdateStep = createStep(
  "send-shipment-update",
  async (input: { vendorOrderId: string }, { container }) => {
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    const customerModuleService = container.resolve(Modules.CUSTOMER)
    const vendorOrder = await orderModuleService.retrieveVendorOrder(input.vendorOrderId)
    const order = await orderModuleService.retrieveMarketplaceOrder(vendorOrder.order_id)
    const customer = await customerModuleService.retrieveCustomer(order.customer_id)
    if (!customer.email) {
      return new StepResponse(null)
    }

    const { subject, body } = shipmentUpdateTemplate({
      fulfillmentCode: vendorOrder.fulfillment_code,
    })
    await recordNotification(container, {
      idempotencyKey: `shipment_update:${input.vendorOrderId}`,
      eventType: "shipment_update",
      to: customer.email,
      subject,
      body,
      recipientType: "customer",
      recipientId: order.customer_id,
      resourceId: input.vendorOrderId,
      resourceType: "vendor_order",
    })
    return new StepResponse(null)
  }
)

export type StartVendorOrderDeliveryWorkflowInput = StartDeliveryInput

export const startVendorOrderDeliveryWorkflowId = "start-vendor-order-delivery"

export const startVendorOrderDeliveryWorkflow = createWorkflow(
  startVendorOrderDeliveryWorkflowId,
  (input: StartVendorOrderDeliveryWorkflowInput) => {
    const vendorOrder = markOutForDeliveryStep(input)
    recordOutForDeliveryAuditLogStep(input)
    sendShipmentUpdateStep({ vendorOrderId: input.vendorOrderId })
    return new WorkflowResponse(vendorOrder)
  }
)
