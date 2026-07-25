import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { createProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"
import { CATEGORY_TRANSLATION_MODULE } from "../modules/category-translation"
import type CategoryTranslationModuleService from "../modules/category-translation/service"
import type { TranslatableLocale } from "../modules/category-translation/locales"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"

/**
 * Categories are platform-owned taxonomy (docs/PRD.md §9.5): creating one
 * touches Medusa's native product-category module (composed here as a step
 * so its own internal compensation applies) plus our custom
 * category_translation rows and the audit log - same atomicity reasoning as
 * create-product-draft.ts.
 */

type CreateTranslationsInput = {
  categoryId: string
  translations: Partial<Record<TranslatableLocale, string>>
}

const createCategoryTranslationsStep = createStep(
  "create-category-translations",
  async (input: CreateTranslationsInput, { container }) => {
    const categoryTranslationModuleService: CategoryTranslationModuleService =
      container.resolve(CATEGORY_TRANSLATION_MODULE)
    const entries = Object.entries(input.translations) as [TranslatableLocale, string][]
    for (const [locale, name] of entries) {
      await categoryTranslationModuleService.upsertTranslation(input.categoryId, locale, name)
    }
    return new StepResponse(null, input.categoryId)
  },
  async (categoryId, { container }) => {
    if (!categoryId) {
      return
    }
    const categoryTranslationModuleService: CategoryTranslationModuleService =
      container.resolve(CATEGORY_TRANSLATION_MODULE)
    await categoryTranslationModuleService.deleteTranslationsForCategory(categoryId)
  }
)

type RecordAuditLogInput = {
  adminUserId: string
  categoryId: string
  name: string
}

const recordCategoryCreatedAuditLogStep = createStep(
  "record-category-created-audit-log",
  async (input: RecordAuditLogInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "user",
      actorId: input.adminUserId,
      action: "category.created",
      entityType: "product_category",
      entityId: input.categoryId,
      afterState: { name: input.name },
    })
    return new StepResponse(auditLog)
  }
)

export type CreateCategoryWorkflowInput = {
  adminUserId: string
  name: string
  parentCategoryId?: string | null
  isActive: boolean
  translations: Partial<Record<TranslatableLocale, string>>
}

export const createCategoryWorkflowId = "create-category"

export const createCategoryWorkflow = createWorkflow(
  createCategoryWorkflowId,
  (input: CreateCategoryWorkflowInput) => {
    const categoryInput = transform({ input }, (data) => ({
      product_categories: [
        {
          name: data.input.name,
          parent_category_id: data.input.parentCategoryId ?? null,
          is_active: data.input.isActive,
        },
      ],
    }))

    const createdCategories = createProductCategoriesWorkflow.runAsStep({
      input: categoryInput,
    })

    const category = transform({ createdCategories }, (data) => data.createdCategories[0])

    const translationsInput = transform({ input, category }, (data) => ({
      categoryId: data.category.id,
      translations: data.input.translations,
    }))

    createCategoryTranslationsStep(translationsInput)

    const auditInput = transform({ input, category }, (data) => ({
      adminUserId: data.input.adminUserId,
      categoryId: data.category.id,
      name: data.input.name,
    }))

    recordCategoryCreatedAuditLogStep(auditInput)

    return new WorkflowResponse({ category })
  }
)
