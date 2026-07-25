import { Module } from "@medusajs/framework/utils"
import WebhookEventModuleService from "./service"

export const WEBHOOK_EVENT_MODULE = "webhook_event"

export default Module(WEBHOOK_EVENT_MODULE, {
  service: WebhookEventModuleService,
})
