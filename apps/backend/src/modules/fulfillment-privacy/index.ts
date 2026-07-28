import { Module } from "@medusajs/framework/utils"
import FulfillmentPrivacyModuleService from "./service"

export const FULFILLMENT_PRIVACY_MODULE = "fulfillment_privacy"

export default Module(FULFILLMENT_PRIVACY_MODULE, {
  service: FulfillmentPrivacyModuleService,
})
