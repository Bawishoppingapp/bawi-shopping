import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { NOTIFICATION_INBOX_MODULE } from "../../../modules/notification-inbox"
import type NotificationInboxModuleService from "../../../modules/notification-inbox/service"

/** A customer's own in-app notification history. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context.actor_id
  const notificationInboxModuleService: NotificationInboxModuleService = req.scope.resolve(
    NOTIFICATION_INBOX_MODULE
  )
  const entries = await notificationInboxModuleService.listNotificationInboxEntries(
    { recipient_type: "customer", recipient_id: customerId },
    { order: { created_at: "DESC" } }
  )

  res.json({
    notifications: entries.map((entry) => ({
      id: entry.id,
      event_type: entry.event_type,
      subject: entry.subject,
      body: entry.body,
      read_at: entry.read_at,
      created_at: entry.created_at,
    })),
  })
}
