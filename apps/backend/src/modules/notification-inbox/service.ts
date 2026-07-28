import { MedusaService } from "@medusajs/framework/utils"
import { NotificationInboxEntry } from "./models/notification-inbox-entry"

class NotificationInboxModuleService extends MedusaService({
  NotificationInboxEntry,
}) {}

export default NotificationInboxModuleService
