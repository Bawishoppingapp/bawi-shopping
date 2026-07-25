import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
  when,
} from "@medusajs/framework/workflows-sdk"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"
import { WEBHOOK_EVENT_MODULE } from "../modules/webhook-event"
import type WebhookEventModuleService from "../modules/webhook-event/service"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"

/**
 * Idempotency-claim-first pattern: step 1 atomically claims the event id
 * (a real DB insert, not check-then-insert - see webhook-event/service.ts).
 * If a later step fails, that claim is compensated away (the
 * processed_webhook_event row is deleted), so a genuine failure lets
 * Stripe's automatic redelivery retry the effect instead of silently
 * losing it. A true duplicate delivery short-circuits before any side
 * effect runs - see docs/PAYMENTS.md §7, docs/DECISIONS.md.
 */

type ClaimEventInput = { eventId: string; eventType: string }

const claimWebhookEventStep = createStep(
  "claim-webhook-event",
  async (input: ClaimEventInput, { container }) => {
    const webhookEventModuleService: WebhookEventModuleService = container.resolve(
      WEBHOOK_EVENT_MODULE
    )
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
    const webhookEventModuleService: WebhookEventModuleService = container.resolve(
      WEBHOOK_EVENT_MODULE
    )
    const [row] = await webhookEventModuleService.listProcessedWebhookEvents({
      provider: "stripe",
      event_id: eventId,
    })
    if (row) {
      await webhookEventModuleService.deleteProcessedWebhookEvents([row.id])
    }
  }
)

type UpdateSellerStripeStatusInput = {
  sellerId: string
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
}

const updateSellerStripeStatusStep = createStep(
  "update-seller-stripe-status",
  async (input: UpdateSellerStripeStatusInput, { container }) => {
    const sellerModuleService: SellerModuleService = container.resolve(SELLER_MODULE)
    const previous = await sellerModuleService.retrieveSeller(input.sellerId)

    const updated = await sellerModuleService.updateSellers({
      id: input.sellerId,
      stripe_charges_enabled: input.chargesEnabled,
      stripe_payouts_enabled: input.payoutsEnabled,
      stripe_details_submitted: input.detailsSubmitted,
    })

    return new StepResponse(updated, {
      sellerId: input.sellerId,
      previousChargesEnabled: previous.stripe_charges_enabled,
      previousPayoutsEnabled: previous.stripe_payouts_enabled,
      previousDetailsSubmitted: previous.stripe_details_submitted,
    })
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const sellerModuleService: SellerModuleService = container.resolve(SELLER_MODULE)
    await sellerModuleService.updateSellers({
      id: compensationInput.sellerId,
      stripe_charges_enabled: compensationInput.previousChargesEnabled,
      stripe_payouts_enabled: compensationInput.previousPayoutsEnabled,
      stripe_details_submitted: compensationInput.previousDetailsSubmitted,
    })
  }
)

type RecordAuditLogInput = {
  sellerId: string
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
}

const recordStripeStatusAuditLogStep = createStep(
  "record-stripe-status-audit-log",
  async (input: RecordAuditLogInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "system",
      actorId: null,
      action: "seller.stripe_status_updated",
      entityType: "seller",
      entityId: input.sellerId,
      vendorId: input.sellerId,
      afterState: {
        charges_enabled: input.chargesEnabled,
        payouts_enabled: input.payoutsEnabled,
        details_submitted: input.detailsSubmitted,
      },
    })
    return new StepResponse(auditLog)
  }
)

export type ApplyStripeAccountUpdatedWebhookWorkflowInput = {
  eventId: string
  eventType: string
  sellerId: string
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
}

export const applyStripeAccountUpdatedWebhookWorkflowId = "apply-stripe-account-updated-webhook"

export const applyStripeAccountUpdatedWebhookWorkflow = createWorkflow(
  applyStripeAccountUpdatedWebhookWorkflowId,
  (input: ApplyStripeAccountUpdatedWebhookWorkflowInput) => {
    const claimed = claimWebhookEventStep({
      eventId: input.eventId,
      eventType: input.eventType,
    })

    // A duplicate delivery (event already claimed) must apply zero side
    // effects - this is what makes the handler idempotent, not just the
    // claim itself.
    when({ claimed }, ({ claimed }) => claimed).then(() => {
      updateSellerStripeStatusStep({
        sellerId: input.sellerId,
        chargesEnabled: input.chargesEnabled,
        payoutsEnabled: input.payoutsEnabled,
        detailsSubmitted: input.detailsSubmitted,
      })

      recordStripeStatusAuditLogStep({
        sellerId: input.sellerId,
        chargesEnabled: input.chargesEnabled,
        payoutsEnabled: input.payoutsEnabled,
        detailsSubmitted: input.detailsSubmitted,
      })
    })

    return new WorkflowResponse({ claimed })
  }
)
