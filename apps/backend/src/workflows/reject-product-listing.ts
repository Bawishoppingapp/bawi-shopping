import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { PRODUCT_LISTING_MODULE } from "../modules/product-listing"
import type ProductListingModuleService from "../modules/product-listing/service"
import type { ProductListingStatus } from "../modules/product-listing/state-machine"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"

type MarkListingRejectedInput = {
  listingId: string
  reason: string
  adminUserId: string
  previousStatus: ProductListingStatus
}

const markListingRejectedStep = createStep(
  "mark-listing-rejected",
  async (input: MarkListingRejectedInput, { container }) => {
    const productListingModuleService: ProductListingModuleService = container.resolve(
      PRODUCT_LISTING_MODULE
    )
    const listing = await productListingModuleService.updateProductListings({
      id: input.listingId,
      status: "rejected",
      rejection_reason: input.reason,
      reviewed_by: input.adminUserId,
      reviewed_at: new Date(),
    })
    return new StepResponse(listing, {
      listingId: input.listingId,
      previousStatus: input.previousStatus,
    })
  },
  async (compensationInput, { container }) => {
    if (!compensationInput) {
      return
    }
    const productListingModuleService: ProductListingModuleService = container.resolve(
      PRODUCT_LISTING_MODULE
    )
    await productListingModuleService.updateProductListings({
      id: compensationInput.listingId,
      status: compensationInput.previousStatus,
      rejection_reason: null,
      reviewed_by: null,
      reviewed_at: null,
    })
  }
)

type RecordRejectionAuditLogInput = {
  adminUserId: string
  listingId: string
  vendorId: string
  reason: string
  previousStatus: ProductListingStatus
}

const recordProductRejectionAuditLogStep = createStep(
  "record-product-rejection-audit-log",
  async (input: RecordRejectionAuditLogInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "user",
      actorId: input.adminUserId,
      action: "product_listing.rejected",
      entityType: "product_listing",
      entityId: input.listingId,
      vendorId: input.vendorId,
      beforeState: { status: input.previousStatus },
      afterState: { status: "rejected", rejection_reason: input.reason },
    })
    return new StepResponse(auditLog)
  }
)

export type RejectProductListingWorkflowInput = {
  listingId: string
  vendorId: string
  reason: string
  adminUserId: string
  previousStatus: ProductListingStatus
}

export const rejectProductListingWorkflowId = "reject-product-listing"

export const rejectProductListingWorkflow = createWorkflow(
  rejectProductListingWorkflowId,
  (input: RejectProductListingWorkflowInput) => {
    const listing = markListingRejectedStep({
      listingId: input.listingId,
      reason: input.reason,
      adminUserId: input.adminUserId,
      previousStatus: input.previousStatus,
    })

    recordProductRejectionAuditLogStep({
      adminUserId: input.adminUserId,
      listingId: input.listingId,
      vendorId: input.vendorId,
      reason: input.reason,
      previousStatus: input.previousStatus,
    })

    return new WorkflowResponse({ listing })
  }
)
