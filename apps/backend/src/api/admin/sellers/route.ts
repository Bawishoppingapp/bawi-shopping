import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SELLER_MODULE } from "../../../modules/seller"
import type SellerModuleService from "../../../modules/seller/service"

/** Admin-only (see middlewares.ts). Read-only visibility into which
 * approved sellers are still not "live" for Stripe purposes - addresses
 * the "approved but not live" risk in docs/IMPLEMENTATION-PLAN.md. Never
 * returns the raw stripe_account_id (same sensitivity tier as vendor_id -
 * see docs/SECURITY.md §12), only the derived status. */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const sellerModuleService: SellerModuleService = req.scope.resolve(SELLER_MODULE)

  const sellers = await sellerModuleService.listSellers(
    {},
    {
      select: [
        "id",
        "name",
        "slug",
        "status",
        "stripe_account_id",
        "stripe_charges_enabled",
        "stripe_payouts_enabled",
        "stripe_details_submitted",
        "public_brand_display_approved",
        "created_at",
      ],
      order: { created_at: "DESC" },
    }
  )

  res.json({
    sellers: sellers.map((seller) => ({
      id: seller.id,
      name: seller.name,
      slug: seller.slug,
      status: seller.status,
      public_brand_display_approved: seller.public_brand_display_approved,
      created_at: seller.created_at,
      stripe: {
        connected: Boolean(seller.stripe_account_id),
        charges_enabled: seller.stripe_charges_enabled,
        payouts_enabled: seller.stripe_payouts_enabled,
        details_submitted: seller.stripe_details_submitted,
      },
    })),
  })
}
