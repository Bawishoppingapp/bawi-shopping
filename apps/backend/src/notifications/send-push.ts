import type { MedusaContainer } from "@medusajs/framework/types"
import { DEVICE_PUSH_TOKEN_MODULE } from "../modules/device-push-token"
import type DevicePushTokenModuleService from "../modules/device-push-token/service"

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send"

/**
 * Best-effort device push via Expo's push API - no SDK dependency, just a
 * plain fetch (see docs/DECISIONS.md, "no unnecessary libraries").
 *
 * This only reaches Expo's push service; it does not guarantee delivery
 * to a device. Getting a real Expo push token onto a device requires a
 * custom Expo dev client with a configured EAS project id (plain Expo Go
 * cannot receive remote push as of SDK 53) - until that's set up on the
 * mobile side, no device will ever have a token registered, so this is
 * a real no-op in every environment this was built in. Never called
 * inline with the notification-send path in a way that could fail it -
 * always fire-and-forget from record-notification.ts.
 */
export async function sendPushForRecipient(
  container: MedusaContainer,
  input: { recipientType: "customer" | "seller_user"; recipientId: string; title: string; body: string }
): Promise<void> {
  try {
    const service: DevicePushTokenModuleService = container.resolve(DEVICE_PUSH_TOKEN_MODULE)
    const tokens = await service.listDevicePushTokens({
      recipient_type: input.recipientType,
      recipient_id: input.recipientId,
    })
    if (tokens.length === 0) {
      return
    }

    await fetch(EXPO_PUSH_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(
        tokens.map((t) => ({
          to: t.expo_push_token,
          title: input.title,
          body: input.body,
          sound: "default",
        }))
      ),
    })
  } catch {
    // Never let a push-delivery failure affect the notification-send path
    // that triggered it (record-notification.ts already sent the real
    // email/inbox-entry regardless of what happens here).
  }
}
