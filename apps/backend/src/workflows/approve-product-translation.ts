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

/** Approving a translation is what makes it customer-visible - see
 * `getApprovedTranslationsForProduct()`, which only ever reads `status:
 * approved` rows. Same atomicity reasoning as approve-product-listing.ts. */

type MarkTranslationApprovedInput = {
  translationId: string
  previousStatus: ProductTranslationStatus
  adminUserId: string
}

const markTranslationApprovedStep = createStep(
  "mark-translation-approved",
  async (input: MarkTranslationApprovedInput, { container }) => {
    const productTranslationModuleService: ProductTranslationModuleService = container.resolve(
      PRODUCT_TRANSLATION_MODULE
    )
    const translation = await productTranslationModuleService.updateProductTranslations({
      id: input.translationId,
      status: "approved",
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
      reviewed_by: null,
      reviewed_at: null,
    })
  }
)

type RecordApprovalAuditLogInput = {
  adminUserId: string
  translationId: string
  vendorId: string
  locale: string
  previousStatus: ProductTranslationStatus
}

const recordTranslationApprovalAuditLogStep = createStep(
  "record-translation-approval-audit-log",
  async (input: RecordApprovalAuditLogInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "user",
      actorId: input.adminUserId,
      action: "product_translation.approved",
      entityType: "product_translation",
      entityId: input.translationId,
      vendorId: input.vendorId,
      beforeState: { status: input.previousStatus },
      afterState: { status: "approved", locale: input.locale },
    })
    return new StepResponse(auditLog)
  }
)

export type ApproveProductTranslationWorkflowInput = {
  translationId: string
  vendorId: string
  locale: string
  adminUserId: string
  previousStatus: ProductTranslationStatus
}

export const approveProductTranslationWorkflowId = "approve-product-translation"

export const approveProductTranslationWorkflow = createWorkflow(
  approveProductTranslationWorkflowId,
  (input: ApproveProductTranslationWorkflowInput) => {
    const translation = markTranslationApprovedStep({
      translationId: input.translationId,
      previousStatus: input.previousStatus,
      adminUserId: input.adminUserId,
    })

    recordTranslationApprovalAuditLogStep({
      adminUserId: input.adminUserId,
      translationId: input.translationId,
      vendorId: input.vendorId,
      locale: input.locale,
      previousStatus: input.previousStatus,
    })

    return new WorkflowResponse(translation)
  }
)
