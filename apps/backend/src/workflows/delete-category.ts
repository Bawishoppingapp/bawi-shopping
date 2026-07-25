import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { deleteProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"
import { CATEGORY_TRANSLATION_MODULE } from "../modules/category-translation"
import type CategoryTranslationModuleService from "../modules/category-translation/service"
import type { TranslatableLocale } from "../modules/category-translation/locales"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"

/**
 * Deletion is only permitted when the category has no child categories and
 * no products assigned - that check happens in the route before this
 * workflow runs (docs/DECISIONS.md), same as the isValidTransition guard on
 * product-listing review actions. This workflow just makes the two-table
 * deletion (native category + translations) plus audit log atomic.
 */

type DeleteTranslationsInput = {
  categoryId: string
  previousTranslations: Partial<Record<TranslatableLocale, string>>
}

const deleteCategoryTranslationsStep = createStep(
  "delete-category-translations",
  async (input: DeleteTranslationsInput, { container }) => {
    const categoryTranslationModuleService: CategoryTranslationModuleService =
      container.resolve(CATEGORY_TRANSLATION_MODULE)
    await categoryTranslationModuleService.deleteTranslationsForCategory(input.categoryId)
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
  name: string
}

const recordCategoryDeletedAuditLogStep = createStep(
  "record-category-deleted-audit-log",
  async (input: RecordAuditLogInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "user",
      actorId: input.adminUserId,
      action: "category.deleted",
      entityType: "product_category",
      entityId: input.categoryId,
      beforeState: { name: input.name },
    })
    return new StepResponse(auditLog)
  }
)

export type DeleteCategoryWorkflowInput = {
  adminUserId: string
  categoryId: string
  name: string
  previousTranslations: Partial<Record<TranslatableLocale, string>>
}

export const deleteCategoryWorkflowId = "delete-category"

export const deleteCategoryWorkflow = createWorkflow(
  deleteCategoryWorkflowId,
  (input: DeleteCategoryWorkflowInput) => {
    deleteProductCategoriesWorkflow.runAsStep({ input: [input.categoryId] })

    deleteCategoryTranslationsStep({
      categoryId: input.categoryId,
      previousTranslations: input.previousTranslations,
    })

    recordCategoryDeletedAuditLogStep({
      adminUserId: input.adminUserId,
      categoryId: input.categoryId,
      name: input.name,
    })

    return new WorkflowResponse({ success: true })
  }
)
