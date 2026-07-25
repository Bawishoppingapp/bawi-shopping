import { model } from "@medusajs/framework/utils"

export const ProductListing = model.define("product_listing", {
  id: model.id().primaryKey(),
  // Plain reference to Medusa's native product.id - deliberately not a hard
  // FK or module-link, same reasoning as seller_application.seller_id: this
  // record's lifecycle (marketplace review) is distinct from the product
  // row's own lifecycle, and the two must stay loosely coupled.
  product_id: model.text().unique(),
  vendor_id: model.text(),
  // Permanent, issued once at creation, never reused or reassigned even if
  // the product is retitled/re-slugged/archived - distinct from the
  // product's (mutable) handle/slug. See docs/DECISIONS.md.
  product_code: model.text().unique(),
  status: model
    .enum(["draft", "pending_review", "approved", "rejected", "archived"])
    .default("draft"),
  // Private - never returned from a public-facing endpoint (same tier as
  // seller_application.rejection_reason).
  rejection_reason: model.text().nullable(),
  submitted_at: model.dateTime().nullable(),
  // Medusa `user` (admin) id of whoever last reviewed this listing - always
  // derived server-side from req.auth_context, never client input.
  reviewed_by: model.text().nullable(),
  reviewed_at: model.dateTime().nullable(),
})
