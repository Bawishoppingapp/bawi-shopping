import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRODUCT_LISTING_MODULE } from "../../../../../modules/product-listing"
import type ProductListingModuleService from "../../../../../modules/product-listing/service"
import { PRODUCT_TRANSLATION_MODULE } from "../../../../../modules/product-translation"
import type ProductTranslationModuleService from "../../../../../modules/product-translation/service"
import { upsertProductTranslationSchema } from "../../../../../modules/product-translation/schemas"
import { resolveVendorId } from "../../../../seller/utils"

/** A seller manages translations for their own product only. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const vendorId = await resolveVendorId(req)
  if (!vendorId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const productListingModuleService: ProductListingModuleService = req.scope.resolve(
    PRODUCT_LISTING_MODULE
  )
  const [listing] = await productListingModuleService.listProductListings({
    id: req.params.id,
    vendor_id: vendorId,
  })
  if (!listing) {
    res.status(404).json({ message: "Product not found" })
    return
  }

  const productTranslationModuleService: ProductTranslationModuleService = req.scope.resolve(
    PRODUCT_TRANSLATION_MODULE
  )
  const translations = await productTranslationModuleService.listProductTranslations({
    product_id: listing.product_id,
  })

  res.json({
    translations: translations.map((translation) => ({
      id: translation.id,
      locale: translation.locale,
      title: translation.title,
      description: translation.description,
      status: translation.status,
      rejection_reason: translation.rejection_reason,
    })),
  })
}

/** Creates or replaces the draft for one locale - always resets to
 * `draft` even if a prior submission was approved/rejected, since an edit
 * must go through review again (see docs/DECISIONS.md). */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const vendorId = await resolveVendorId(req)
  if (!vendorId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

  const parsed = upsertProductTranslationSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? "Invalid request" })
    return
  }

  const productListingModuleService: ProductListingModuleService = req.scope.resolve(
    PRODUCT_LISTING_MODULE
  )
  const [listing] = await productListingModuleService.listProductListings({
    id: req.params.id,
    vendor_id: vendorId,
  })
  if (!listing) {
    res.status(404).json({ message: "Product not found" })
    return
  }

  const productTranslationModuleService: ProductTranslationModuleService = req.scope.resolve(
    PRODUCT_TRANSLATION_MODULE
  )
  const translation = await productTranslationModuleService.upsertDraft({
    productId: listing.product_id,
    vendorId,
    locale: parsed.data.locale,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
  })

  res.status(201).json({
    translation: {
      id: translation.id,
      locale: translation.locale,
      title: translation.title,
      description: translation.description,
      status: translation.status,
    },
  })
}
