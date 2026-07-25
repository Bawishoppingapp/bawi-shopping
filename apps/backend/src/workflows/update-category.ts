import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { updateProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"
import { CATEGORY_TRANSLATION_MODULE } from "../modules/category-translation"
import type CategoryTranslationModuleService from "../modules/category-translation/service"
import type { TranslatableLocale } from "../modules/category-translation/locales"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"

/**
 * Native updateProductCategoriesWorkflow already captures + restores the
 * previous category row on failure (see update-product-categories step in
 * @medusajs/core-flows). This workflow adds the same guarantee for
 * translation upserts and the audit log, composed the same way as
 * approve-product-listing.ts.
 */

type UpsertTranslationsInput = {
  categoryId: string
  translations: Partial<Record<TranslatableLocale, string>>
  previousTranslations: Partial<Record<TranslatableLocale, string>>
}

const upsertCategoryTranslationsStep = createStep(
  "upsert-category-translations",
  async (input: UpsertTranslationsInput, { container }) => {
    const categoryTranslationModuleService: CategoryTranslationModuleService =
      container.resolve(CATEGORY_TRANSLATION_MODULE)
    const entries = Object.entries(input.translations) as [TranslatableLocale, string][]
    for (const [locale, name] of entries) {
      await categoryTranslationModuleService.upsertTranslation(input.categoryId, locale, name)
    }
    return new StepResponse(null, input)
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const categoryTranslationModuleService: CategoryTranslationModuleService =
      container.resolve(CATEGORY_TRANSLATION_MODULE)
    const entries = Object.entries(compensationInput.previousTranslations) as [
      TranslatableLocale,
      string
    ][]
    for (const [locale, name] of entries) {
      await categoryTranslationModuleService.upsertTranslation(
        compensationInput.categoryId,
        locale,
        name
      )
    }
  }
)

type RecordAuditLogInput = {
  adminUserId: string
  categoryId: string
  before: Record<string, unknown>
  after: Record<string, unknown>
}

const recordCategoryUpdatedAuditLogStep = createStep(
  "record-category-updated-audit-log",
  async (input: RecordAuditLogInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "user",
      actorId: input.adminUserId,
      action: "category.updated",
      entityType: "product_category",
      entityId: input.categoryId,
      beforeState: input.before,
      afterState: input.after,
    })
    return new StepResponse(auditLog)
  }
)

export type UpdateCategoryWorkflowInput = {
  adminUserId: string
  categoryId: string
  name?: string
  parentCategoryId?: string | null
  isActive?: boolean
  translations: Partial<Record<TranslatableLocale, string>>
  previousTranslations: Partial<Record<TranslatableLocale, string>>
  previousState: Record<string, unknown>
}

export const updateCategoryWorkflowId = "update-category"

export const updateCategoryWorkflow = createWorkflow(
  updateCategoryWorkflowId,
  (input: UpdateCategoryWorkflowInput) => {
    const updateInput = transform({ input }, (data) => ({
      selector: { id: data.input.categoryId },
      update: {
        ...(data.input.name !== undefined ? { name: data.input.name } : {}),
        ...(data.input.parentCategoryId !== undefined
          ? { parent_category_id: data.input.parentCategoryId }
          : {}),
        ...(data.input.isActive !== undefined ? { is_active: data.input.isActive } : {}),
      },
    }))

    const updatedCategories = updateProductCategoriesWorkflow.runAsStep({
      input: updateInput,
    })

    const category = transform({ updatedCategories }, (data) => data.updatedCategories[0])

    const translationsInput = transform({ input }, (data) => ({
      categoryId: data.input.categoryId,
      translations: data.input.translations,
      previousTranslations: data.input.previousTranslations,
    }))

    upsertCategoryTranslationsStep(translationsInput)

    const auditInput = transform({ input, category }, (data) => ({
      adminUserId: data.input.adminUserId,
      categoryId: data.input.categoryId,
      before: data.input.previousState,
      after: {
        name: data.category.name,
        parent_category_id: data.category.parent_category_id,
        is_active: data.category.is_active,
      },
    }))

    recordCategoryUpdatedAuditLogStep(auditInput)

    return new WorkflowResponse({ category })
  }
)
