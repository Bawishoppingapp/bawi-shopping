import { model } from "@medusajs/framework/utils"
import { SellerUser } from "./seller-user"

export const Seller = model.define("seller", {
  id: model.id().primaryKey(),
  name: model.text(),
  slug: model.text().unique(),
  status: model
    .enum(["pending", "approved", "suspended", "rejected"])
    .default("pending"),
  // Stripe Connect Express onboarding (see docs/DECISIONS.md,
  // docs/PAYMENTS.md §2). Only an opaque account-id reference plus status
  // booleans derived from account.updated webhooks - never bank details,
  // identity documents, tax IDs, or the full Stripe account object.
  stripe_account_id: model.text().unique().nullable(),
  stripe_charges_enabled: model.boolean().default(false),
  stripe_payouts_enabled: model.boolean().default(false),
  stripe_details_submitted: model.boolean().default(false),
  // A vendor's own store name/brand is private by default; only Bawi admin
  // approval makes it publicly displayable (see docs/DECISIONS.md). This
  // is distinct from a normal product brand, which is already public.
  public_brand_display_approved: model.boolean().default(false),
  // Currency the seller's whole catalog is priced in - a per-seller
  // setting, not per-product, since a real seller operates in one market
  // (see docs/DECISIONS.md's Ethiopian-market entry). Chosen at
  // application time. Defaults "etb" - the platform's current primary
  // market is Ethiopia; USD/US stays fully supported, just no longer
  // the assumed default (see CLAUDE.md's "Currency and market" section).
  currency_code: model.enum(["usd", "etb"]).default("etb"),
  users: model.hasMany(() => SellerUser, { mappedBy: "seller" }),
})
