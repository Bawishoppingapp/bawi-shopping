import { model } from "@medusajs/framework/utils"

/**
 * A customer's saved-for-later products. `product_code` is a plain
 * reference to product_listing.product_code (loose coupling, same
 * precedent as seller_application.seller_id) - not a hard FK, since this
 * record's lifecycle is independent of the listing's own (a delisted
 * product simply drops out of the resolved response, see
 * src/wishlist/wishlist-catalog.ts). No DB-level unique constraint on
 * (customer_id, product_code) - duplicate-save prevention is an
 * application-layer check-then-create, same pattern already used by
 * src/api/seller-applications/route.ts for its pending-application check.
 */
export const WishlistItem = model.define("wishlist_item", {
  id: model.id().primaryKey(),
  customer_id: model.text(),
  product_code: model.text(),
})
