import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { CATEGORY_TRANSLATION_MODULE } from "../../../../modules/category-translation"
import type CategoryTranslationModuleService from "../../../../modules/category-translation/service"
import { updateCategorySchema } from "../../../../modules/category-translation/schemas"
import { updateCategoryWorkflow } from "../../../../workflows/update-category"
import { deleteCategoryWorkflow } from "../../../../workflows/delete-category"
import { wouldCreateCycle } from "../utils"

/** Admin-only (see middlewares.ts). */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const categoryTranslationModuleService: CategoryTranslationModuleService = req.scope.resolve(
    CATEGORY_TRANSLATION_MODULE
  )

  const [category] = await productModuleService.listProductCategories(
    { id: req.params.id },
    { select: ["id", "name", "handle", "parent_category_id", "is_active"] }
  )
  if (!category) {
    res.status(404).json({ message: "Category not found" })
    return
  }

  const translations = await categoryTranslationModuleService.getTranslationsForCategory(
    category.id
  )

  res.json({
    category: {
      id: category.id,
      name: category.name,
      handle: category.handle,
      parent_category_id: category.parent_category_id,
      is_active: category.is_active,
      translations,
    },
  })
}

/** Admin-only (see middlewares.ts). Rejects a `parent_category_id` that
 * would make the category its own ancestor. */
export async function PUT(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const parsed = updateCategorySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() })
    return
  }
  const input = parsed.data

  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const categoryTranslationModuleService: CategoryTranslationModuleService = req.scope.resolve(
    CATEGORY_TRANSLATION_MODULE
  )

  const [existing] = await productModuleService.listProductCategories(
    { id: req.params.id },
    { select: ["id", "name", "handle", "parent_category_id", "is_active"] }
  )
  if (!existing) {
    res.status(404).json({ message: "Category not found" })
    return
  }

  if (input.parent_category_id) {
    const allCategories = await productModuleService.listProductCategories(
      {},
      { select: ["id", "parent_category_id"] }
    )
    const [parent] = await productModuleService.listProductCategories({
      id: input.parent_category_id,
    })
    if (!parent) {
      res.status(422).json({ message: "Parent category not found" })
      return
    }
    if (wouldCreateCycle(existing.id, input.parent_category_id, allCategories)) {
      res.status(422).json({
        message: "A category cannot be moved under itself or one of its own descendants",
      })
      return
    }
  }

  const previousTranslations = await categoryTranslationModuleService.getTranslationsForCategory(
    existing.id
  )

  const adminUserId = req.auth_context.actor_id

  const { result } = await updateCategoryWorkflow(req.scope).run({
    input: {
      adminUserId,
      categoryId: existing.id,
      name: input.name,
      parentCategoryId: input.parent_category_id,
      isActive: input.is_active,
      translations: input.translations ?? {},
      previousTranslations,
      previousState: {
        name: existing.name,
        parent_category_id: existing.parent_category_id,
        is_active: existing.is_active,
      },
    },
  })

  res.json({ category: result.category })
}

/** Admin-only (see middlewares.ts). Refuses to delete a category that still
 * has child categories or products assigned - the caller must reassign
 * those first (docs/DECISIONS.md). */
export async function DELETE(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const productModuleService = req.scope.resolve(Modules.PRODUCT)
  const categoryTranslationModuleService: CategoryTranslationModuleService = req.scope.resolve(
    CATEGORY_TRANSLATION_MODULE
  )

  const [existing] = await productModuleService.listProductCategories(
    { id: req.params.id },
    { select: ["id", "name", "handle", "parent_category_id", "is_active"] }
  )
  if (!existing) {
    res.status(404).json({ message: "Category not found" })
    return
  }

  const children = await productModuleService.listProductCategories({
    parent_category_id: existing.id,
  })
  if (children.length > 0) {
    res.status(409).json({ message: "Cannot delete a category that has child categories" })
    return
  }

  const productsInCategory = await productModuleService.listProducts(
    { categories: { id: [existing.id] } },
    { take: 1 }
  )
  if (productsInCategory.length > 0) {
    res.status(409).json({ message: "Cannot delete a category that has products assigned" })
    return
  }

  const previousTranslations = await categoryTranslationModuleService.getTranslationsForCategory(
    existing.id
  )

  const adminUserId = req.auth_context.actor_id

  await deleteCategoryWorkflow(req.scope).run({
    input: {
      adminUserId,
      categoryId: existing.id,
      name: existing.name,
      previousTranslations,
    },
  })

  res.status(200).json({ success: true })
}
