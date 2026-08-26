import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { DEVICE_PUSH_TOKEN_MODULE } from "../../../modules/device-push-token"
import type DevicePushTokenModuleService from "../../../modules/device-push-token/service"

const registerPushTokenSchema = z.object({
  expo_push_token: z.string().trim().min(1),
  platform: z.enum(["ios", "android"]).optional(),
})

/**
 * Registers (or re-registers) a device for push notifications. A device
 * belongs to whoever is currently logged in on it - registering the same
 * expo_push_token again just overwrites the recipient rather than
 * creating a second row (see device-push-token.ts's model comment).
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = registerPushTokenSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors })
    return
  }

  const service: DevicePushTokenModuleService = req.scope.resolve(DEVICE_PUSH_TOKEN_MODULE)
  const customerId = req.auth_context.actor_id

  const [existing] = await service.listDevicePushTokens({
    expo_push_token: parsed.data.expo_push_token,
  })

  if (existing) {
    await service.updateDevicePushTokens({
      id: existing.id,
      recipient_type: "customer",
      recipient_id: customerId,
      platform: parsed.data.platform ?? existing.platform ?? null,
    })
  } else {
    await service.createDevicePushTokens({
      recipient_type: "customer",
      recipient_id: customerId,
      expo_push_token: parsed.data.expo_push_token,
      platform: parsed.data.platform ?? null,
    })
  }

  res.status(200).json({ success: true })
}

const unregisterPushTokenSchema = z.object({
  expo_push_token: z.string().trim().min(1),
})

/** Called on logout, while the session token is still valid, so a stale
 * token doesn't keep receiving pushes for an account no longer signed in
 * on this device. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = unregisterPushTokenSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors })
    return
  }

  const service: DevicePushTokenModuleService = req.scope.resolve(DEVICE_PUSH_TOKEN_MODULE)
  const [existing] = await service.listDevicePushTokens({
    expo_push_token: parsed.data.expo_push_token,
    recipient_type: "customer",
    recipient_id: req.auth_context.actor_id,
  })
  if (existing) {
    await service.deleteDevicePushTokens([existing.id])
  }

  res.status(200).json({ success: true })
}
