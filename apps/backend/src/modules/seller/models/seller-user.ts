import { model } from "@medusajs/framework/utils"
import { Seller } from "./seller"

export const SellerUser = model.define("seller_user", {
  id: model.id().primaryKey(),
  // Links this record to its Medusa auth identity (actor type "seller_user").
  // Never used as an authorization input from the client — always resolved
  // server-side from the authenticated request's auth context.
  auth_identity_id: model.text(),
  role: model
    .enum(["owner", "catalog_manager", "order_fulfiller", "analyst"])
    .default("owner"),
  seller: model.belongsTo(() => Seller, { mappedBy: "users" }),
})
