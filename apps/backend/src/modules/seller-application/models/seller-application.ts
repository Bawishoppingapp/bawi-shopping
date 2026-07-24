import { model } from "@medusajs/framework/utils"

export const SellerApplication = model.define("seller_application", {
  id: model.id().primaryKey(),

  // Business
  legal_business_name: model.text(),
  store_name: model.text(),
  business_type: model.enum([
    "sole_proprietorship",
    "llc",
    "corporation",
    "partnership",
    "other",
  ]),
  business_description: model.text(),
  estimated_product_count: model.number(),
  product_categories: model.json(), // string[]
  address: model.json(), // { line1, line2?, city, state, postal_code, country }

  // Contact
  contact_first_name: model.text(),
  contact_last_name: model.text(),
  business_email: model.text(),
  phone_number: model.text(),
  website_url: model.text().nullable(),

  agreed_to_terms: model.boolean(),
  submitted_at: model.dateTime(),

  // Review lifecycle
  status: model
    .enum([
      "draft",
      "submitted",
      "under_review",
      "approved",
      "rejected",
      "withdrawn",
    ])
    .default("submitted"),
  // Private - never returned from a public-facing endpoint.
  rejection_reason: model.text().nullable(),
  // Medusa `user` (admin) id of whoever last changed the review status -
  // always derived server-side from req.auth_context, never client input.
  reviewed_by: model.text().nullable(),
  reviewed_at: model.dateTime().nullable(),
  // Set once approval creates the Seller record. A plain reference (not a
  // Medusa module-link) since it's a one-directional "which seller resulted
  // from this application" pointer used for display/idempotency only.
  seller_id: model.text().nullable(),
})
