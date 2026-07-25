import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

/**
 * Read-only category list for the seller portal's product-creation form.
 * Categories are platform-owned (see docs/PRD.md §9.5) - sellers can only
 * assign products to existing categories, never create/edit them here.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const categories = await productModuleService.listProductCategories(
    { is_active: true },
    { select: ["id", "name", "parent_category_id"], order: { rank: "ASC" } }
  )
  res.json({ categories })
}
