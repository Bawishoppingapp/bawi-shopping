import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { NOTIFICATION_INBOX_MODULE } from "../../../modules/notification-inbox"
import type NotificationInboxModuleService from "../../../modules/notification-inbox/service"
import { resolveVendorId } from "../../seller/utils"

/** A seller's own in-app notification history (scoped to their vendor_id,
 * not to which seller_user happens to be logged in - any staff member of
 * this seller sees the same inbox, matching how fulfillment/returns are
 * scoped in this project). */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const vendorId = await resolveVendorId(req)
  if (!vendorId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const notificationInboxModuleService: NotificationInboxModuleService = req.scope.resolve(
    NOTIFICATION_INBOX_MODULE
  )
  const entries = await notificationInboxModuleService.listNotificationInboxEntries(
    { recipient_type: "seller_user", vendor_id: vendorId },
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
