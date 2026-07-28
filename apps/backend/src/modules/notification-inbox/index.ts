import { Module } from "@medusajs/framework/utils"
import NotificationInboxModuleService from "./service"

export const NOTIFICATION_INBOX_MODULE = "notification_inbox"

export default Module(NOTIFICATION_INBOX_MODULE, {
  service: NotificationInboxModuleService,
})
