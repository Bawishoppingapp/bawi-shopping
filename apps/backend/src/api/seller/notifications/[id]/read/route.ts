import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { NOTIFICATION_INBOX_MODULE } from "../../../../../modules/notification-inbox"
import type NotificationInboxModuleService from "../../../../../modules/notification-inbox/service"
import { resolveVendorId } from "../../../utils"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const vendorId = await resolveVendorId(req)
  if (!vendorId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const notificationInboxModuleService: NotificationInboxModuleService = req.scope.resolve(
    NOTIFICATION_INBOX_MODULE
  )
  const entry = await notificationInboxModuleService
    .retrieveNotificationInboxEntry(req.params.id)
    .catch(() => null)
  if (!entry || entry.recipient_type !== "seller_user" || entry.vendor_id !== vendorId) {
    res.status(404).json({ message: "Notification not found" })
    return
  }

  const updated = await notificationInboxModuleService.updateNotificationInboxEntries({
    id: entry.id,
    read_at: entry.read_at ?? new Date(),
  })
  res.json({ notification: { id: updated.id, read_at: updated.read_at } })
}
