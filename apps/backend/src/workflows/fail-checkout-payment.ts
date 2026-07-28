import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
  when,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { WEBHOOK_EVENT_MODULE } from "../modules/webhook-event"
import type WebhookEventModuleService from "../modules/webhook-event/service"
import { MARKETPLACE_ORDER_MODULE } from "../modules/marketplace-order"
import type OrderModuleService from "../modules/marketplace-order/service"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"

/**
 * Runs on `payment_intent.payment_failed` - releases the inventory hold so
 * it isn't tied up against an abandoned checkout, but deliberately leaves
 * the customer's cart untouched (it was never cleared - only a successful
 * capture clears it, see capture-checkout-payment.ts) so the customer can
 * simply retry checkout. Same idempotency-claim-first pattern as the other
 * payment webhook workflows.
 */

type ClaimEventInput = { eventId: string; eventType: string }

const claimWebhookEventStep = createStep(
  "claim-webhook-event",
  async (input: ClaimEventInput, { container }) => {
    const webhookEventModuleService: WebhookEventModuleService =
      container.resolve(WEBHOOK_EVENT_MODULE)
    const claimed = await webhookEventModuleService.markProcessed(
      "stripe",
      input.eventId,
      input.eventType
    )
    return new StepResponse(claimed, claimed ? input.eventId : null)
  },
  async (eventId, { container }) => {
    if (!eventId) {
      return
    }
    const webhookEventModuleService: WebhookEventModuleService =
      container.resolve(WEBHOOK_EVENT_MODULE)
    const [row] = await webhookEventModuleService.listProcessedWebhookEvents({
      provider: "stripe",
      event_id: eventId,
    })
    if (row) {
      await webhookEventModuleService.deleteProcessedWebhookEvents([row.id])
    }
  }
)

type ReleaseReservationsInput = { reservationItemIds: string[] }

const releaseReservationsStep = createStep(
  "release-reservations",
  async (input: ReleaseReservationsInput, { container }) => {
    if (input.reservationItemIds.length) {
      const inventoryModuleService = container.resolve(Modules.INVENTORY)
      await inventoryModuleService.deleteReservationItems(input.reservationItemIds)
    }
    return new StepResponse(true)
  }
)

type MarkOrderFailedInput = { orderId: string }

const markOrderFailedStep = createStep(
  "mark-order-failed",
  async (input: MarkOrderFailedInput, { container }) => {
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    const order = await orderModuleService.updateMarketplaceOrders({
      id: input.orderId,
      status: "payment_failed",
      payment_status: "failed",
    })
    return new StepResponse(order, input.orderId)
  },
  async (orderId, { container }) => {
    if (!orderId) {
      return
    }
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    await orderModuleService.updateMarketplaceOrders({
      id: orderId,
      status: "pending_payment",
      payment_status: "pending",
    })
  }
)

type RecordAuditLogInput = { orderId: string; customerId: string }

const recordPaymentFailedAuditLogStep = createStep(
  "record-payment-failed-audit-log",
  async (input: RecordAuditLogInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "system",
      actorId: null,
      action: "order.payment_failed",
      entityType: "order",
      entityId: input.orderId,
      afterState: { status: "payment_failed" },
    })
    return new StepResponse(auditLog)
  }
)

export type FailCheckoutPaymentWorkflowInput = {
  eventId: string
  eventType: string
  orderId: string
  customerId: string
  reservationItemIds: string[]
}

export const failCheckoutPaymentWorkflowId = "fail-checkout-payment"

export const failCheckoutPaymentWorkflow = createWorkflow(
  failCheckoutPaymentWorkflowId,
  (input: FailCheckoutPaymentWorkflowInput) => {
    const claimed = claimWebhookEventStep({
      eventId: input.eventId,
      eventType: input.eventType,
    })

    when({ claimed }, ({ claimed }) => claimed).then(() => {
      releaseReservationsStep({ reservationItemIds: input.reservationItemIds })
      markOrderFailedStep({ orderId: input.orderId })
      recordPaymentFailedAuditLogStep({
        orderId: input.orderId,
        customerId: input.customerId,
      })
    })

    return new WorkflowResponse({ claimed })
  }
)
