import { MedusaError, MedusaService } from "@medusajs/framework/utils"
import { ProcessedWebhookEvent } from "./models/processed-webhook-event"

class WebhookEventModuleService extends MedusaService({
  ProcessedWebhookEvent,
}) {
  async hasProcessed(provider: string, eventId: string): Promise<boolean> {
    const [existing] = await this.listProcessedWebhookEvents({
      provider,
      event_id: eventId,
    })
    return Boolean(existing)
  }

  /**
   * Atomically claims (provider, event_id) via the table's unique index -
   * a real INSERT, not a check-then-insert race. Returns `true` if this
   * call is the one that claimed it (the caller should apply the event's
   * side effect); returns `false` if it was already claimed (the caller
   * must skip the side effect - this is what makes webhook handling
   * idempotent under Stripe's at-least-once redelivery guarantee).
   */
  async markProcessed(provider: string, eventId: string, eventType: string): Promise<boolean> {
    try {
      await this.createProcessedWebhookEvents({
        provider,
        event_id: eventId,
        event_type: eventType,
        processed_at: new Date(),
      })
      return true
    } catch {
      // Almost certainly a unique-constraint violation from a concurrent
      // or redelivered event. Confirm it's genuinely already claimed
      // before treating this as a no-op, so a real DB error doesn't get
      // silently swallowed.
      const alreadyClaimed = await this.hasProcessed(provider, eventId)
      if (alreadyClaimed) {
        return false
      }
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        `Could not record webhook event ${provider}/${eventId}`
      )
    }
  }
}

export default WebhookEventModuleService
