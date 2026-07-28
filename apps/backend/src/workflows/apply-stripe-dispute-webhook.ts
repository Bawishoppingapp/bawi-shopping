import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
  when,
} from "@medusajs/framework/workflows-sdk"
import type { MedusaContainer } from "@medusajs/framework/types"
import { MARKETPLACE_ORDER_MODULE } from "../modules/marketplace-order"
import type OrderModuleService from "../modules/marketplace-order/service"
import { SELLER_FINANCE_MODULE } from "../modules/seller-finance"
import type SellerFinanceModuleService from "../modules/seller-finance/service"
import { WEBHOOK_EVENT_MODULE } from "../modules/webhook-event"
import type WebhookEventModuleService from "../modules/webhook-event/service"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"

/**
 * A Stripe dispute is raised against the platform's own charge (the
 * customer-facing PaymentIntent covers the whole cart, not a per-vendor
 * charge - see docs/PAYMENTS.md), so one dispute can span every vendor_order
 * under a marketplace order. `Dispute.vendor_order_id` is only set when
 * exactly one vendor_order exists on the order; every affected vendor_order's
 * "order"-reason ledger entry gets `disputed_at` frozen regardless, since
 * that's what actually blocks payout (docs/PAYMENTS.md §6).
 *
 * Same claim-first idempotency pattern as
 * apply-stripe-account-updated-webhook.ts: a duplicate delivery of the same
 * Stripe event id applies zero side effects.
 */

type ClaimEventInput = { eventId: string; eventType: string }

const claimDisputeWebhookEventStep = createStep(
  "claim-dispute-webhook-event",
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

type ApplyDisputeCreatedInput = {
  orderId: string
  stripeDisputeId: string
  amount: number
  reason: string | null
}
type ApplyDisputeCreatedCompensation = {
  disputeId: string | null
  disputedEntryIds: string[]
}

const applyDisputeCreatedStep = createStep(
  "apply-dispute-created",
  async (input: ApplyDisputeCreatedInput, { container }) => {
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )

    const vendorOrders = await orderModuleService.listVendorOrders({ order_id: input.orderId })

    const dispute = await sellerFinanceModuleService.createDisputes({
      order_id: input.orderId,
      vendor_order_id: vendorOrders.length === 1 ? vendorOrders[0].id : null,
      stripe_dispute_id: input.stripeDisputeId,
      amount: input.amount,
      reason: input.reason,
      status: "open",
    })

    const disputedEntryIds: string[] = []
    const now = new Date()
    for (const vendorOrder of vendorOrders) {
      const [ledgerEntry] = await sellerFinanceModuleService.listCommissionLedgerEntries({
        vendor_order_id: vendorOrder.id,
        reason: "order",
      })
      if (ledgerEntry && !ledgerEntry.disputed_at) {
        await sellerFinanceModuleService.updateCommissionLedgerEntries({
          id: ledgerEntry.id,
          disputed_at: now,
        })
        disputedEntryIds.push(ledgerEntry.id)
      }
    }

    const compensation: ApplyDisputeCreatedCompensation = {
      disputeId: dispute.id,
      disputedEntryIds,
    }
    return new StepResponse(dispute, compensation)
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    for (const entryId of compensationInput.disputedEntryIds) {
      await sellerFinanceModuleService.updateCommissionLedgerEntries({
        id: entryId,
        disputed_at: null,
      })
    }
    if (compensationInput.disputeId) {
      await sellerFinanceModuleService.deleteDisputes([compensationInput.disputeId])
    }
  }
)

type ApplyDisputeClosedInput = { stripeDisputeId: string; won: boolean }

const applyDisputeClosedStep = createStep(
  "apply-dispute-closed",
  async (input: ApplyDisputeClosedInput, { container }) => {
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    const orderModuleService: OrderModuleService = container.resolve(MARKETPLACE_ORDER_MODULE)
    const [dispute] = await sellerFinanceModuleService.listDisputes({
      stripe_dispute_id: input.stripeDisputeId,
    })
    if (!dispute) {
      return new StepResponse(null, null)
    }

    await sellerFinanceModuleService.updateDisputes({
      id: dispute.id,
      status: input.won ? "won" : "lost",
      resolved_at: new Date(),
    })

    // A won dispute releases the freeze (the entry returns to whatever
    // bucket its own available_at/paid_at say). A lost dispute leaves
    // disputed_at set permanently - the seller's balance is reduced by
    // that entry's net_amount for good; there is no chargeback-reversal
    // ledger entry in v1, so this is surfaced for manual admin review
    // rather than auto-reconciled (see docs/DECISIONS.md).
    //
    // Every vendor_order under the SAME marketplace order is re-derived
    // from `order_id` (not `dispute.vendor_order_id`, which is only ever
    // set for the single-vendor case) so a multi-vendor dispute clears
    // every affected entry, not just one.
    const clearedEntryIds: string[] = []
    if (input.won) {
      const vendorOrders = await orderModuleService.listVendorOrders({
        order_id: dispute.order_id,
      })
      for (const vendorOrder of vendorOrders) {
        const [entry] = await sellerFinanceModuleService.listCommissionLedgerEntries({
          vendor_order_id: vendorOrder.id,
          reason: "order",
        })
        if (entry?.disputed_at) {
          await sellerFinanceModuleService.updateCommissionLedgerEntries({
            id: entry.id,
            disputed_at: null,
          })
          clearedEntryIds.push(entry.id)
        }
      }
    }

    return new StepResponse(dispute, { disputeId: dispute.id, clearedEntryIds })
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    for (const entryId of compensationInput.clearedEntryIds) {
      await sellerFinanceModuleService.updateCommissionLedgerEntries({
        id: entryId,
        disputed_at: new Date(),
      })
    }
  }
)

type RecordDisputeAuditLogInput = {
  action: "dispute.opened" | "dispute.closed"
  orderId: string | null
  stripeDisputeId: string
  afterState: Record<string, unknown>
}

async function recordDisputeAuditLog(container: MedusaContainer, input: RecordDisputeAuditLogInput) {
  const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
  return auditLogModuleService.record({
    actorType: "system",
    actorId: null,
    action: input.action,
    entityType: "dispute",
    entityId: input.stripeDisputeId,
    afterState: input.afterState,
  })
}

// Two distinct steps (not one shared step called twice) - Medusa's workflow
// orchestrator rejects invoking the same step definition at two call sites
// within one workflow ("Step ... is already defined in workflow"), caught
// by `db:migrate` loading this file (see docs/DECISIONS.md).
const recordDisputeOpenedAuditLogStep = createStep(
  "record-dispute-opened-audit-log",
  async (input: RecordDisputeAuditLogInput, { container }) => {
    const auditLog = await recordDisputeAuditLog(container, input)
    return new StepResponse(auditLog)
  }
)

const recordDisputeClosedAuditLogStep = createStep(
  "record-dispute-closed-audit-log",
  async (input: RecordDisputeAuditLogInput, { container }) => {
    const auditLog = await recordDisputeAuditLog(container, input)
    return new StepResponse(auditLog)
  }
)

export type ApplyStripeDisputeWebhookWorkflowInput = {
  eventId: string
  eventType: string
  orderId: string | null
  stripeDisputeId: string
  amount: number
  reason: string | null
  isClosedEvent: boolean
  won: boolean
}

export const applyStripeDisputeWebhookWorkflowId = "apply-stripe-dispute-webhook"

export const applyStripeDisputeWebhookWorkflow = createWorkflow(
  applyStripeDisputeWebhookWorkflowId,
  (input: ApplyStripeDisputeWebhookWorkflowInput) => {
    const claimed = claimDisputeWebhookEventStep({
      eventId: input.eventId,
      eventType: input.eventType,
    })

    // Two sibling (never nested) `when().then()` blocks - Medusa's workflow
    // composer errors at definition time ("Cannot read properties of
    // undefined (reading 'steps')") if a `when().then()` is nested inside
    // another one's callback, so both branches are gated on the combined
    // `claimed && <event-type>` condition instead.
    when(
      { claimed, input },
      ({ claimed, input }) => claimed && !input.isClosedEvent && !!input.orderId
    ).then(() => {
      applyDisputeCreatedStep({
        orderId: input.orderId as string,
        stripeDisputeId: input.stripeDisputeId,
        amount: input.amount,
        reason: input.reason,
      })
      recordDisputeOpenedAuditLogStep({
        action: "dispute.opened",
        orderId: input.orderId,
        stripeDisputeId: input.stripeDisputeId,
        afterState: { status: "open", amount: input.amount },
      })
    })

    when(
      { claimed, input },
      ({ claimed, input }) => claimed && input.isClosedEvent
    ).then(() => {
      applyDisputeClosedStep({ stripeDisputeId: input.stripeDisputeId, won: input.won })
      const closedStatus = transform({ input }, ({ input }) => (input.won ? "won" : "lost"))
      recordDisputeClosedAuditLogStep({
        action: "dispute.closed",
        orderId: input.orderId,
        stripeDisputeId: input.stripeDisputeId,
        afterState: { status: closedStatus },
      })
    })

    return new WorkflowResponse({ claimed })
  }
)
