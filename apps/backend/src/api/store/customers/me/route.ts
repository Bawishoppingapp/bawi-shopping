import { removeCustomerAccountWorkflow } from "@medusajs/core-flows"
import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { DEVICE_PUSH_TOKEN_MODULE } from "../../../../modules/device-push-token"
import type DevicePushTokenModuleService from "../../../../modules/device-push-token/service"
import { NOTIFICATION_INBOX_MODULE } from "../../../../modules/notification-inbox"
import type NotificationInboxModuleService from "../../../../modules/notification-inbox/service"
import { WISHLIST_MODULE } from "../../../../modules/wishlist"
import type WishlistModuleService from "../../../../modules/wishlist/service"

/** Deletes the authenticated customer's account and sign-in identity.
 * Commerce records that must remain auditable (orders, returns, refunds)
 * are intentionally retained; optional profile data is removed with the
 * Medusa customer, and device tokens/wishlist/inbox data are purged here. */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context.actor_id
  const wishlist: WishlistModuleService = req.scope.resolve(WISHLIST_MODULE)
  const pushTokens: DevicePushTokenModuleService = req.scope.resolve(DEVICE_PUSH_TOKEN_MODULE)
  const inbox: NotificationInboxModuleService = req.scope.resolve(NOTIFICATION_INBOX_MODULE)

  const [wishlistItems, deviceTokens, notifications] = await Promise.all([
    wishlist.listWishlistItems({ customer_id: customerId }),
    pushTokens.listDevicePushTokens({ recipient_type: "customer", recipient_id: customerId }),
    inbox.listNotificationInboxEntries({ recipient_type: "customer", recipient_id: customerId }),
  ])

  await Promise.all([
    wishlistItems.length ? wishlist.deleteWishlistItems(wishlistItems.map((item) => item.id)) : Promise.resolve(),
    deviceTokens.length ? pushTokens.deleteDevicePushTokens(deviceTokens.map((token) => token.id)) : Promise.resolve(),
    notifications.length ? inbox.deleteNotificationInboxEntries(notifications.map((entry) => entry.id)) : Promise.resolve(),
  ])

  await removeCustomerAccountWorkflow(req.scope).run({ input: { customerId } })
  res.status(200).json({ success: true })
}
