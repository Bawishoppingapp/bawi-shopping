import { model } from "@medusajs/framework/utils"
import { Seller } from "./seller"

export const SellerUser = model.define("seller_user", {
  id: model.id().primaryKey(),
  // The login identity for this seller user. Set at creation time
  // (from the seller application's business email on approval, or
  // directly for dev-seeded sellers) - independent of auth_identity_id,
  // which only exists once the account is activated.
  email: model.text(),
  // Links this record to its Medusa auth identity (actor type "seller_user").
  // Null until the seller completes activation (see activation_token
  // below) - never used as an authorization input from the client, always
  // resolved server-side from the authenticated request's auth context.
  auth_identity_id: model.text().nullable(),
  role: model
    .enum(["owner", "catalog_manager", "order_fulfiller", "analyst"])
    .default("owner"),
  // Single-use token for the "set your password" activation flow that
  // follows seller-application approval. Cleared once consumed.
  activation_token: model.text().unique().nullable(),
  activation_token_expires_at: model.dateTime().nullable(),
  seller: model.belongsTo(() => Seller, { mappedBy: "users" }),
})
