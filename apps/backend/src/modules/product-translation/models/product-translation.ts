import { model } from "@medusajs/framework/utils"

/**
 * `product_id` is a plain reference to Medusa's native product.id -
 * deliberately not a hard FK or module-link, same loose-coupling
 * convention as product_listing.product_id and category_translation.
 * category_id. English is never stored here: the native product's own
 * title/description ARE the English content (same "base row implicit"
 * convention as category_translation) - a missing/unapproved translation
 * row falls back to those at read time, never a blank string.
 *
 * Unlike category_translation (platform-owned, admin-authored, immediately
 * live), a product translation goes through the same seller-submits/
 * admin-approves moderation shape as the product listing itself (see
 * CLAUDE.md §Localization, docs/PRD.md §9.24) - hence the status/
 * rejection_reason/reviewed_by fields mirroring product_listing.
 */
export const ProductTranslation = model.define("product_translation", {
  id: model.id().primaryKey(),
  product_id: model.text(),
  vendor_id: model.text(),
  locale: model.enum(["am", "ti", "om", "zh-CN", "es"]),
  title: model.text(),
  description: model.text().nullable(),
  status: model.enum(["draft", "pending_review", "approved", "rejected"]).default("draft"),
  // Private - never returned from a public-facing endpoint (same tier as
  // product_listing.rejection_reason).
  rejection_reason: model.text().nullable(),
  submitted_at: model.dateTime().nullable(),
  reviewed_by: model.text().nullable(),
  reviewed_at: model.dateTime().nullable(),
})
