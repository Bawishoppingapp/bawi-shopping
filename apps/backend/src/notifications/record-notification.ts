import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { NOTIFICATION_INBOX_MODULE } from "../modules/notification-inbox"
import type NotificationInboxModuleService from "../modules/notification-inbox/service"
import { sendPushForRecipient } from "./send-push"

/**
 * Every event this platform notifies a party about - see docs/PRD.md
 * §9.20. Bawi-controlled communication only: there is no event here that
 * sends a customer's or seller's identity to the other party (CLAUDE.md
 * rule #12) - every recipient is notified about their own side of a
 * transaction, never the counterparty's.
 */
export type NotificationEventType =
  | "order_confirmation"
  | "shipment_update"
  | "delivery_confirmation"
  | "return_status_changed"
  | "refund_processed"
  | "payout_sent"
  | "seller_application_approved"
  | "seller_application_rejected"
  | "password_reset"

export interface RecordNotificationInput {
  /** Dedup key, e.g. `order_confirmation:${orderId}` - passed straight
   * through as Medusa's native `idempotency_key`, which already refuses to
   * re-send a notification with the same key (see docs/DECISIONS.md). */
  idempotencyKey: string
  eventType: NotificationEventType
  to: string
  subject: string
  body: string
  html?: string
  /** Omit both when there's no in-app account to index this against yet
   * (e.g. a rejected seller application - no seller_user is ever created
   * for it) - the email still sends, there's just no inbox row, since
   * nothing could ever query it. */
  recipientType?: "customer" | "seller_user" | "user"
  recipientId?: string
  vendorId?: string | null
  resourceId?: string
  resourceType?: string
}

/**
 * Sends via Medusa's native `notification` module (the `local` provider -
 * console/logger only until `real_email_enabled` is turned on and a real
 * provider is configured, see docs/DECISIONS.md) and indexes it into this
 * project's own `notification_inbox_entry` table for a per-recipient,
 * queryable "notification center" - the native module has no receiver-
 * scoped store/seller API and no read/unread state, so it can't serve
 * that on its own (see docs/DECISIONS.md).
 */
export async function recordNotification(
  container: MedusaContainer,
  input: RecordNotificationInput
): Promise<void> {
  const escapedBody = input.body
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replaceAll("\n", "<br />")
  const notificationModuleService = container.resolve(Modules.NOTIFICATION)
  const notification = await notificationModuleService.createNotifications({
    to: input.to,
    channel: "email",
    template: input.eventType,
    // Brevo/SendGrid consume `html`; the local provider and notification record
    // retain `text`. Supplying both keeps development logs useful and avoids
    // real emails being delivered with an empty body.
    content: { subject: input.subject, text: input.body, html: input.html ?? escapedBody },
    trigger_type: input.eventType,
    resource_id: input.resourceId,
    resource_type: input.resourceType,
    idempotency_key: input.idempotencyKey,
  })

  if (!input.recipientType || !input.recipientId) {
    return
  }

  const notificationInboxModuleService: NotificationInboxModuleService = container.resolve(
    NOTIFICATION_INBOX_MODULE
  )
  try {
    await notificationInboxModuleService.createNotificationInboxEntries({
      notification_id: notification.id,
      event_type: input.eventType,
      recipient_type: input.recipientType,
      recipient_id: input.recipientId,
      vendor_id: input.vendorId ?? null,
      subject: input.subject,
      body: input.body,
    })
  } catch {
    // A repeated idempotency_key means the native call above returned the
    // already-existing notification rather than creating a new one, so an
    // inbox entry (unique on notification_id) already exists too - not a
    // real error, just the dedup path.
  }

  if (input.recipientType === "customer" || input.recipientType === "seller_user") {
    // Fire-and-forget - see send-push.ts for why this never affects the
    // notification-send path that triggered it.
    void sendPushForRecipient(container, {
      recipientType: input.recipientType,
      recipientId: input.recipientId,
      title: input.subject,
      body: input.body,
    })
  }
}
