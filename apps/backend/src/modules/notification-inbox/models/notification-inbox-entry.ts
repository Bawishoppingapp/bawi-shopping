import { model } from "@medusajs/framework/utils"

/**
 * A thin, queryable per-recipient index over Medusa's native `notification`
 * module (see docs/DECISIONS.md) - the native module sends and stores the
 * notification itself (real dedup via its own `idempotency_key`, see
 * `src/notifications/record-notification.ts`), but exposes no receiver-
 * scoped store/seller API and no read/unread state, which an in-app
 * notification center needs. `notification_id` is a plain reference to the
 * native notification.id (different module, same loose-coupling pattern
 * as vendor_id elsewhere in this project) and is unique so a duplicate
 * send (deduped upstream) never produces a second inbox row.
 */
export const NotificationInboxEntry = model.define("notification_inbox_entry", {
  id: model.id().primaryKey(),
  notification_id: model.text().unique(),
  event_type: model.text(),
  recipient_type: model.enum(["customer", "seller_user", "user"]),
  recipient_id: model.text(),
  vendor_id: model.text().nullable(),
  subject: model.text(),
  body: model.text(),
  read_at: model.dateTime().nullable(),
})
