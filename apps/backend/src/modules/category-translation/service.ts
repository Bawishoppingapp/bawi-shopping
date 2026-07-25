import { MedusaService } from "@medusajs/framework/utils"
import { CategoryTranslation } from "./models/category-translation"
import type { TranslatableLocale } from "./locales"

class CategoryTranslationModuleService extends MedusaService({
  CategoryTranslation,
}) {
  /** Replaces the translation for one (category_id, locale) pair. */
  async upsertTranslation(categoryId: string, locale: TranslatableLocale, name: string) {
    const [existing] = await this.listCategoryTranslations({
      category_id: categoryId,
      locale,
    })
    if (existing) {
      return this.updateCategoryTranslations({ id: existing.id, name })
    }
    return this.createCategoryTranslations({ category_id: categoryId, locale, name })
  }

  /** Returns { locale: name } for every translation this category has. */
  async getTranslationsForCategory(categoryId: string): Promise<Record<string, string>> {
    const rows = await this.listCategoryTranslations({ category_id: categoryId })
    return Object.fromEntries(rows.map((row) => [row.locale, row.name]))
  }

  /** Batched version of getTranslationsForCategory for list views. */
  async getTranslationsForCategories(
    categoryIds: string[]
  ): Promise<Map<string, Record<string, string>>> {
    if (!categoryIds.length) {
      return new Map()
    }
    const rows = await this.listCategoryTranslations({ category_id: categoryIds })
    const map = new Map<string, Record<string, string>>()
    for (const row of rows) {
      const existing = map.get(row.category_id) ?? {}
      existing[row.locale] = row.name
      map.set(row.category_id, existing)
    }
    return map
  }

  async deleteTranslationsForCategory(categoryId: string): Promise<void> {
    const rows = await this.listCategoryTranslations({ category_id: categoryId })
    if (rows.length) {
      await this.deleteCategoryTranslations(rows.map((row) => row.id))
    }
  }
}

export default CategoryTranslationModuleService
