import { model } from "@medusajs/framework/utils"

/**
 * One row per device (unique on expo_push_token, not per recipient) -
 * a device belongs to whoever is currently logged in on it, so
 * registering the same token again simply overwrites recipient_type/
 * recipient_id rather than creating a second row. This is registration
 * state only; nothing in this module sends a push itself (see
 * src/notifications/send-push.ts, called best-effort from
 * record-notification.ts).
 */
export const DevicePushToken = model.define("device_push_token", {
  id: model.id().primaryKey(),
  recipient_type: model.enum(["customer", "seller_user"]),
  recipient_id: model.text(),
  expo_push_token: model.text().unique(),
  platform: model.enum(["ios", "android"]).nullable(),
})
