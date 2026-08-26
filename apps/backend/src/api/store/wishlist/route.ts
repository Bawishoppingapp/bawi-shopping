import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { ProductSearchHit } from "@bawi/search-contract"
import { WISHLIST_MODULE } from "../../../modules/wishlist"
import type WishlistModuleService from "../../../modules/wishlist/service"
import { resolveWishlistHits } from "../../../wishlist/wishlist-catalog"
import { addWishlistItemSchema } from "../../../wishlist/schemas"

/** A customer's saved products, resolved into display-ready hits - same
 * shape as the public product-search endpoint's `products`, so the
 * mobile/web client needs no new response-mapping code. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context.actor_id
  const wishlistModuleService: WishlistModuleService = req.scope.resolve(WISHLIST_MODULE)
  const items = await wishlistModuleService.listWishlistItems(
    { customer_id: customerId },
    { order: { created_at: "DESC" } }
  )

  const hitsByCode = await resolveWishlistHits(
    req.scope,
    items.map((item) => item.product_code)
  )
  const products = items
    .map((item) => hitsByCode.get(item.product_code))
    .filter((hit): hit is ProductSearchHit => Boolean(hit))

  res.json({ products })
}

/** Idempotent - saving the same product_code twice never duplicates or
 * errors, same check-then-create pattern as the anonymous seller
 * application intake's pending-application check. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = addWishlistItemSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors })
    return
  }

  const customerId = req.auth_context.actor_id
  const wishlistModuleService: WishlistModuleService = req.scope.resolve(WISHLIST_MODULE)

  const [existing] = await wishlistModuleService.listWishlistItems({
    customer_id: customerId,
    product_code: parsed.data.product_code,
  })
  if (!existing) {
    await wishlistModuleService.createWishlistItems({
      customer_id: customerId,
      product_code: parsed.data.product_code,
    })
  }

  res.status(200).json({ success: true })
}
