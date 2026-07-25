import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { CATEGORY_TRANSLATION_MODULE } from "../../../modules/category-translation"
import type CategoryTranslationModuleService from "../../../modules/category-translation/service"
import { createCategorySchema } from "../../../modules/category-translation/schemas"
import { createCategoryWorkflow } from "../../../workflows/create-category"
import { buildCategoryTree } from "./utils"

/** Admin-only (see middlewares.ts). Returns every category (active and
 * inactive) as a nested tree, each node annotated with its translation map,
 * so the admin UI can manage the whole taxonomy in one screen. */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const categoryTranslationModuleService: CategoryTranslationModuleService = req.scope.resolve(
    CATEGORY_TRANSLATION_MODULE
  )

  const categories = await productModuleService.listProductCategories(
    {},
    {
      select: ["id", "name", "handle", "parent_category_id", "is_active", "rank"],
      order: { rank: "ASC" },
    }
  )

  const translationsByCategory = await categoryTranslationModuleService.getTranslationsForCategories(
    categories.map((category) => category.id)
  )

  const withTranslations = categories.map((category) => ({
    id: category.id,
    name: category.name,
    handle: category.handle,
    parent_category_id: category.parent_category_id,
    is_active: category.is_active,
    translations: translationsByCategory.get(category.id) ?? {},
  }))

  res.json({ categories: buildCategoryTree(withTranslations) })
}

/** Admin-only (see middlewares.ts). Creates a category, optionally nested
 * under a parent, with optional translations for any of the five
 * non-English locales. */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const parsed = createCategorySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() })
    return
  }
  const input = parsed.data

  if (input.parent_category_id) {
    const productModuleService = req.scope.resolve(Modules.PRODUCT)
    const [parent] = await productModuleService.listProductCategories({
      id: input.parent_category_id,
    })
    if (!parent) {
      res.status(422).json({ message: "Parent category not found" })
      return
    }
  }

  const adminUserId = req.auth_context.actor_id

  const { result } = await createCategoryWorkflow(req.scope).run({
    input: {
      adminUserId,
      name: input.name,
      parentCategoryId: input.parent_category_id ?? null,
      isActive: input.is_active,
      translations: input.translations ?? {},
    },
  })

  res.status(201).json({ category: result.category })
}
