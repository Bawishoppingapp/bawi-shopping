import { Module } from "@medusajs/framework/utils"
import DevicePushTokenModuleService from "./service"

export const DEVICE_PUSH_TOKEN_MODULE = "device_push_token"

export default Module(DEVICE_PUSH_TOKEN_MODULE, {
  service: DevicePushTokenModuleService,
})
