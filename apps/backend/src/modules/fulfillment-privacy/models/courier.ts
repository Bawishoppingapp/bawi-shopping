import { model } from "@medusajs/framework/utils"

/**
 * Its own actor type ("courier"), not a seller-side or customer-side
 * account - see docs/USER-ROLES.md §2.7. Couriers are provisioned directly
 * by an admin (not self-service application, unlike sellers), but reuse
 * the exact same activation-token pattern as `seller_user` since no
 * notification service exists yet to email the activation link (see
 * docs/DECISIONS.md).
 */
export const Courier = model.define("courier", {
  id: model.id().primaryKey(),
  name: model.text(),
  // Login identity - internal-ops contact detail, never shown to a
  // customer or seller (see docs/SECURITY.md §11).
  email: model.text().unique(),
  phone: model.text().nullable(),
  auth_identity_id: model.text().nullable(),
  activation_token: model.text().unique().nullable(),
  activation_token_expires_at: model.dateTime().nullable(),
  status: model.enum(["active", "inactive"]).default("active"),
})
