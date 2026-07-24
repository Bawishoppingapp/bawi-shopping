import { model } from "@medusajs/framework/utils"
import { SellerUser } from "./seller-user"

export const Seller = model.define("seller", {
  id: model.id().primaryKey(),
  name: model.text(),
  slug: model.text().unique(),
  status: model
    .enum(["pending", "approved", "suspended", "rejected"])
    .default("pending"),
  users: model.hasMany(() => SellerUser, { mappedBy: "seller" }),
})
