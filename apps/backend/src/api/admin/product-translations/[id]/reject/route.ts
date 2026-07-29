import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRODUCT_TRANSLATION_MODULE } from "../../../../../modules/product-translation"
import type ProductTranslationModuleService from "../../../../../modules/product-translation/service"
import { isValidTransition } from "../../../../../modules/product-translation/state-machine"
import { rejectProductTranslationSchema } from "../../../../../modules/product-translation/schemas"
import { rejectProductTranslationWorkflow } from "../../../../../workflows/reject-product-translation"

export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = rejectProductTranslationSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid request" })
    return
  }

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

  if (translation.status === "rejected") {
    res.json({ translation, already_rejected: true })
    return
  }
  if (!isValidTransition(translation.status, "rejected")) {
    res.status(422).json({
      message: `Cannot reject a translation with status "${translation.status}"`,
    })
    return
  }

  const { result } = await rejectProductTranslationWorkflow(req.scope).run({
    input: {
      translationId: translation.id,
      vendorId: translation.vendor_id,
      locale: translation.locale,
      reason: parsed.data.reason,
      adminUserId: req.auth_context.actor_id,
      previousStatus: translation.status,
    },
  })

  res.json({ translation: result })
}
