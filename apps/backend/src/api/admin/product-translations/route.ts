import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRODUCT_TRANSLATION_MODULE } from "../../../modules/product-translation"
import type ProductTranslationModuleService from "../../../modules/product-translation/service"

/** Admin-only (see middlewares.ts). Defaults to the review queue
 * (`pending_review`) - pass `?status=` to see any other status. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const productTranslationModuleService: ProductTranslationModuleService = req.scope.resolve(
    PRODUCT_TRANSLATION_MODULE
  )
  const status = typeof req.query.status === "string" ? req.query.status : "pending_review"

  const translations = await productTranslationModuleService.listProductTranslations(
    { status },
    { order: { created_at: "ASC" } }
  )

  res.json({
    translations: translations.map((translation) => ({
      id: translation.id,
      product_id: translation.product_id,
      vendor_id: translation.vendor_id,
      locale: translation.locale,
      title: translation.title,
      description: translation.description,
      status: translation.status,
      rejection_reason: translation.rejection_reason,
      submitted_at: translation.submitted_at,
    })),
  })
}
