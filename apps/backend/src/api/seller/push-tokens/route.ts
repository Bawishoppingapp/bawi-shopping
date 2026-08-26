import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { DEVICE_PUSH_TOKEN_MODULE } from "../../../modules/device-push-token"
import type DevicePushTokenModuleService from "../../../modules/device-push-token/service"

const registerPushTokenSchema = z.object({
  expo_push_token: z.string().trim().min(1),
  platform: z.enum(["ios", "android"]).optional(),
})

/** Mirrors store/push-tokens/route.ts exactly, scoped to seller_user
 * instead of customer - see that file's comments for the shared
 * registration semantics. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = registerPushTokenSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors })
    return
  }

  const service: DevicePushTokenModuleService = req.scope.resolve(DEVICE_PUSH_TOKEN_MODULE)
  const sellerUserId = req.auth_context.actor_id

  const [existing] = await service.listDevicePushTokens({
    expo_push_token: parsed.data.expo_push_token,
  })

  if (existing) {
    await service.updateDevicePushTokens({
      id: existing.id,
      recipient_type: "seller_user",
      recipient_id: sellerUserId,
      platform: parsed.data.platform ?? existing.platform ?? null,
    })
  } else {
    await service.createDevicePushTokens({
      recipient_type: "seller_user",
      recipient_id: sellerUserId,
      expo_push_token: parsed.data.expo_push_token,
      platform: parsed.data.platform ?? null,
    })
  }

  res.status(200).json({ success: true })
}

const unregisterPushTokenSchema = z.object({
  expo_push_token: z.string().trim().min(1),
})

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = unregisterPushTokenSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors })
    return
  }

  const service: DevicePushTokenModuleService = req.scope.resolve(DEVICE_PUSH_TOKEN_MODULE)
  const [existing] = await service.listDevicePushTokens({
    expo_push_token: parsed.data.expo_push_token,
    recipient_type: "seller_user",
    recipient_id: req.auth_context.actor_id,
  })
  if (existing) {
    await service.deleteDevicePushTokens([existing.id])
  }

  res.status(200).json({ success: true })
}
