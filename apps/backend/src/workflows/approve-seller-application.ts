import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"
import { SELLER_APPLICATION_MODULE } from "../modules/seller-application"
import type SellerApplicationModuleService from "../modules/seller-application/service"
import type { SellerApplicationStatus } from "../modules/seller-application/state-machine"
import {
  ACTIVATION_TOKEN_TTL_MS,
  generateActivationToken,
} from "../modules/seller-application/utils"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"

/**
 * Approving an application touches four records across three modules
 * (seller, seller_user, seller_application, audit_log). This workflow is
 * what makes that all-or-nothing: each step that writes data has a
 * compensation that undoes it, so a failure partway through (e.g. the
 * audit-log write fails after the seller was created) rolls back everything
 * already applied instead of leaving an approved-looking seller with no
 * application record pointing at it. See docs/DECISIONS.md.
 */

type CreateApprovedSellerInput = { storeName: string; slug: string }

const createApprovedSellerStep = createStep(
  "create-approved-seller",
  async (input: CreateApprovedSellerInput, { container }) => {
    const sellerModuleService: SellerModuleService = container.resolve(SELLER_MODULE)
    const seller = await sellerModuleService.createSellers({
      name: input.storeName,
      slug: input.slug,
      status: "approved",
    })
    return new StepResponse(seller, seller.id)
  },
  async (sellerId, { container }) => {
    if (!sellerId) {
      return
    }
    const sellerModuleService: SellerModuleService = container.resolve(SELLER_MODULE)
    await sellerModuleService.deleteSellers([sellerId])
  }
)

type CreateSellerUserInput = { sellerId: string; email: string }

const createSellerUserForOwnerStep = createStep(
  "create-seller-user-for-owner",
  async (input: CreateSellerUserInput, { container }) => {
    const sellerModuleService: SellerModuleService = container.resolve(SELLER_MODULE)
    const sellerUser = await sellerModuleService.createSellerUsers({
      seller_id: input.sellerId,
      email: input.email,
      role: "owner",
      activation_token: generateActivationToken(),
      activation_token_expires_at: new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS),
    })
    return new StepResponse(sellerUser, sellerUser.id)
  },
  async (sellerUserId, { container }) => {
    if (!sellerUserId) {
      return
    }
    const sellerModuleService: SellerModuleService = container.resolve(SELLER_MODULE)
    await sellerModuleService.deleteSellerUsers([sellerUserId])
  }
)

type MarkApplicationApprovedInput = {
  applicationId: string
  sellerId: string
  adminUserId: string
  previousStatus: SellerApplicationStatus
}

const markApplicationApprovedStep = createStep(
  "mark-application-approved",
  async (input: MarkApplicationApprovedInput, { container }) => {
    const sellerApplicationModuleService: SellerApplicationModuleService = container.resolve(
      SELLER_APPLICATION_MODULE
    )
    const application = await sellerApplicationModuleService.updateSellerApplications({
      id: input.applicationId,
      status: "approved",
      seller_id: input.sellerId,
      reviewed_by: input.adminUserId,
      reviewed_at: new Date(),
    })
    return new StepResponse(application, {
      applicationId: input.applicationId,
      previousStatus: input.previousStatus,
    })
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const sellerApplicationModuleService: SellerApplicationModuleService = container.resolve(
      SELLER_APPLICATION_MODULE
    )
    await sellerApplicationModuleService.updateSellerApplications({
      id: compensationInput.applicationId,
      status: compensationInput.previousStatus,
      seller_id: null,
      reviewed_by: null,
      reviewed_at: null,
    })
  }
)

type RecordApprovalAuditLogInput = {
  adminUserId: string
  applicationId: string
  sellerId: string
  previousStatus: SellerApplicationStatus
}

const recordApprovalAuditLogStep = createStep(
  "record-approval-audit-log",
  async (input: RecordApprovalAuditLogInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "user",
      actorId: input.adminUserId,
      action: "seller_application.approved",
      entityType: "seller_application",
      entityId: input.applicationId,
      vendorId: input.sellerId,
      beforeState: { status: input.previousStatus },
      afterState: { status: "approved", seller_id: input.sellerId },
    })
    // No compensation: this is the workflow's last step, so its
    // compensation would only ever run if a later step failed - there is
    // none. Audit-log rows are also intentionally append-only.
    return new StepResponse(auditLog)
  }
)

export type ApproveSellerApplicationWorkflowInput = {
  applicationId: string
  storeName: string
  slug: string
  businessEmail: string
  adminUserId: string
  previousStatus: SellerApplicationStatus
}

export const approveSellerApplicationWorkflowId = "approve-seller-application"

export const approveSellerApplicationWorkflow = createWorkflow(
  approveSellerApplicationWorkflowId,
  (input: ApproveSellerApplicationWorkflowInput) => {
    const seller = createApprovedSellerStep({
      storeName: input.storeName,
      slug: input.slug,
    })

    const sellerUser = createSellerUserForOwnerStep({
      sellerId: seller.id,
      email: input.businessEmail,
    })

    const application = markApplicationApprovedStep({
      applicationId: input.applicationId,
      sellerId: seller.id,
      adminUserId: input.adminUserId,
      previousStatus: input.previousStatus,
    })

    recordApprovalAuditLogStep({
      adminUserId: input.adminUserId,
      applicationId: input.applicationId,
      sellerId: seller.id,
      previousStatus: input.previousStatus,
    })

    return new WorkflowResponse({ application, seller, sellerUser })
  }
)
