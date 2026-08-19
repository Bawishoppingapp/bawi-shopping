import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { WISHLIST_MODULE } from "../../../../modules/wishlist"
import type WishlistModuleService from "../../../../modules/wishlist/service"

export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const customerId = req.auth_context.actor_id
  const wishlistModuleService: WishlistModuleService = req.scope.resolve(WISHLIST_MODULE)

  const [entry] = await wishlistModuleService.listWishlistItems({
    customer_id: customerId,
    product_code: req.params.productCode,
  })
  if (!entry || entry.customer_id !== customerId) {
    res.status(404).json({ message: "Not found" })
    return
  }

  await wishlistModuleService.deleteWishlistItems(entry.id)
  res.status(200).json({ success: true })
}
