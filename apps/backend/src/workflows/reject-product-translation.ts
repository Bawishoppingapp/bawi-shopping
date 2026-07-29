import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { PRODUCT_TRANSLATION_MODULE } from "../modules/product-translation"
import type ProductTranslationModuleService from "../modules/product-translation/service"
import type { ProductTranslationStatus } from "../modules/product-translation/state-machine"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"

type MarkTranslationRejectedInput = {
  translationId: string
  reason: string
  previousStatus: ProductTranslationStatus
  adminUserId: string
}

const markTranslationRejectedStep = createStep(
  "mark-translation-rejected",
  async (input: MarkTranslationRejectedInput, { container }) => {
    const productTranslationModuleService: ProductTranslationModuleService = container.resolve(
      PRODUCT_TRANSLATION_MODULE
    )
    const translation = await productTranslationModuleService.updateProductTranslations({
      id: input.translationId,
      status: "rejected",
      rejection_reason: input.reason,
      reviewed_by: input.adminUserId,
      reviewed_at: new Date(),
    })
    return new StepResponse(translation, input)
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const productTranslationModuleService: ProductTranslationModuleService = container.resolve(
      PRODUCT_TRANSLATION_MODULE
    )
    await productTranslationModuleService.updateProductTranslations({
      id: compensationInput.translationId,
      status: compensationInput.previousStatus,
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
    })
  }
)

type RecordRejectionAuditLogInput = {
  adminUserId: string
  translationId: string
  vendorId: string
  locale: string
  reason: string
  previousStatus: ProductTranslationStatus
}

const recordTranslationRejectionAuditLogStep = createStep(
  "record-translation-rejection-audit-log",
  async (input: RecordRejectionAuditLogInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "user",
      actorId: input.adminUserId,
      action: "product_translation.rejected",
      entityType: "product_translation",
      entityId: input.translationId,
      vendorId: input.vendorId,
      beforeState: { status: input.previousStatus },
      afterState: { status: "rejected", locale: input.locale, rejection_reason: input.reason },
    })
    return new StepResponse(auditLog)
  }
)

export type RejectProductTranslationWorkflowInput = {
  translationId: string
  vendorId: string
  locale: string
  reason: string
  adminUserId: string
  previousStatus: ProductTranslationStatus
}

export const rejectProductTranslationWorkflowId = "reject-product-translation"

export const rejectProductTranslationWorkflow = createWorkflow(
  rejectProductTranslationWorkflowId,
  (input: RejectProductTranslationWorkflowInput) => {
    const translation = markTranslationRejectedStep({
      translationId: input.translationId,
      reason: input.reason,
      previousStatus: input.previousStatus,
      adminUserId: input.adminUserId,
    })

    recordTranslationRejectionAuditLogStep({
      adminUserId: input.adminUserId,
      translationId: input.translationId,
      vendorId: input.vendorId,
      locale: input.locale,
      reason: input.reason,
      previousStatus: input.previousStatus,
    })

    return new WorkflowResponse(translation)
  }
)
