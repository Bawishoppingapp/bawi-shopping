import { model } from "@medusajs/framework/utils"

export const ProcessedWebhookEvent = model.define("processed_webhook_event", {
  id: model.id().primaryKey(),
  provider: model.text(),
  event_id: model.text(),
  event_type: model.text(),
  processed_at: model.dateTime(),
})
