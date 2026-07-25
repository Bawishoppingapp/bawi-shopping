import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { CATEGORY_TRANSLATION_MODULE } from "../../modules/category-translation"
import type CategoryTranslationModuleService from "../../modules/category-translation/service"
import { isTranslatableLocale } from "../../modules/category-translation/locales"
import { buildCategoryTree } from "../admin/categories/utils"

/**
 * Public, unauthenticated. Only `is_active` categories - inactive ones are
 * an admin-only draft state (docs/PRD.md §9.5). `name` is translated for
 * `?locale=`, falling back to the category's own (English) `name` when no
 * translation row exists for that locale, per the localization requirement
 * (docs/PRD.md §9.24).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const categoryTranslationModuleService: CategoryTranslationModuleService = req.scope.resolve(
    CATEGORY_TRANSLATION_MODULE
  )

  const requestedLocale = typeof req.query.locale === "string" ? req.query.locale : undefined
  const locale =
    requestedLocale && isTranslatableLocale(requestedLocale) ? requestedLocale : undefined

  const categories = await productModuleService.listProductCategories(
    { is_active: true },
    {
      select: ["id", "name", "handle", "parent_category_id"],
      order: { rank: "ASC" },
    }
  )

  const translationsByCategory = locale
    ? await categoryTranslationModuleService.getTranslationsForCategories(
        categories.map((category) => category.id)
      )
    : new Map<string, Record<string, string>>()

  const localized = categories.map((category) => ({
    id: category.id,
    name: (locale && translationsByCategory.get(category.id)?.[locale]) || category.name,
    handle: category.handle,
    parent_category_id: category.parent_category_id,
  }))

  res.json({ categories: buildCategoryTree(localized) })
}
