import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRODUCT_TRANSLATION_MODULE } from "../../../../../modules/product-translation"
import type ProductTranslationModuleService from "../../../../../modules/product-translation/service"
import { isValidTransition } from "../../../../../modules/product-translation/state-machine"
import { approveProductTranslationWorkflow } from "../../../../../workflows/approve-product-translation"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const productTranslationModuleService: ProductTranslationModuleService = req.scope.resolve(
    PRODUCT_TRANSLATION_MODULE
  )

  let translation
  try {
    translation = await productTranslationModuleService.retrieveProductTranslation(req.params.id)
  } catch {
    res.status(404).json({ message: "Translation not found" })
    return
  }

  if (translation.status === "approved") {
    res.json({ translation, already_approved: true })
    return
  }
  if (!isValidTransition(translation.status, "approved")) {
    res.status(422).json({
      message: `Cannot approve a translation with status "${translation.status}"`,
    })
    return
  }

  const { result } = await approveProductTranslationWorkflow(req.scope).run({
    input: {
      translationId: translation.id,
      vendorId: translation.vendor_id,
      locale: translation.locale,
      adminUserId: req.auth_context.actor_id,
      previousStatus: translation.status,
    },
  })

  res.json({ translation: result })
}
