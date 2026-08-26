import { MedusaService } from "@medusajs/framework/utils"
import { DevicePushToken } from "./models/device-push-token"

class DevicePushTokenModuleService extends MedusaService({
  DevicePushToken,
}) {}

export default DevicePushTokenModuleService
