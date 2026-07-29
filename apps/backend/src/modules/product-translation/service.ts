import { MedusaService } from "@medusajs/framework/utils"
import { ProductTranslation } from "./models/product-translation"
import type { TranslatableLocale } from "../category-translation/locales"

class ProductTranslationModuleService extends MedusaService({
  ProductTranslation,
}) {
  /** One row per (product_id, locale) - creates the draft if none exists
   * yet, otherwise updates the existing row and resets it to draft (an
   * edit to an already-submitted/approved translation must go through
   * review again, same as any product-listing edit). */
  async upsertDraft(input: {
    productId: string
    vendorId: string
    locale: TranslatableLocale
    title: string
    description: string | null
  }) {
    const [existing] = await this.listProductTranslations({
      product_id: input.productId,
      locale: input.locale,
    })
    if (existing) {
      return this.updateProductTranslations({
        id: existing.id,
        title: input.title,
        description: input.description,
        status: "draft",
        rejection_reason: null,
        submitted_at: null,
        reviewed_by: null,
        reviewed_at: null,
      })
    }
    return this.createProductTranslations({
      product_id: input.productId,
      vendor_id: input.vendorId,
      locale: input.locale,
      title: input.title,
      description: input.description,
    })
  }

  /** Returns { locale: { title, description } } for every *approved*
   * translation this product has - the only ones ever customer-visible. */
  async getApprovedTranslationsForProduct(
    productId: string
  ): Promise<Record<string, { title: string; description: string | null }>> {
    const rows = await this.listProductTranslations({
      product_id: productId,
      status: "approved",
    })
    return Object.fromEntries(
      rows.map((row) => [row.locale, { title: row.title, description: row.description }])
    )
  }
}

export default ProductTranslationModuleService
