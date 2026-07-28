import { model } from "@medusajs/framework/utils"

export const CartMergeClaim = model.define("cart_merge_claim", {
  id: model.id().primaryKey(),
  guest_cart_id: model.text().unique(),
  customer_id: model.text(),
  claimed_at: model.dateTime(),
})
