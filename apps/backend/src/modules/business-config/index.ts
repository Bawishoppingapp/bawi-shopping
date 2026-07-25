import { Module } from "@medusajs/framework/utils"
import BusinessConfigModuleService from "./service"

export const BUSINESS_CONFIG_MODULE = "business_config"

export default Module(BUSINESS_CONFIG_MODULE, {
  service: BusinessConfigModuleService,
})
