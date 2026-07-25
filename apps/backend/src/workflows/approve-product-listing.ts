import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { PRODUCT_LISTING_MODULE } from "../modules/product-listing"
import type ProductListingModuleService from "../modules/product-listing/service"
import type { ProductListingStatus } from "../modules/product-listing/state-machine"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"

/**
 * Approving a product touches our product_listing module (status) and
 * Medusa's native product module (flipping status to "published" so native
 * mechanics also treat it as live) plus the audit log - same atomicity
 * reasoning as approve-seller-application.ts.
 */

type MarkListingApprovedInput = {
  listingId: string
  previousStatus: ProductListingStatus
  adminUserId: string
}

const markListingApprovedStep = createStep(
  "mark-listing-approved",
  async (input: MarkListingApprovedInput, { container }) => {
    const productListingModuleService: ProductListingModuleService = container.resolve(
      PRODUCT_LISTING_MODULE
    )
    const listing = await productListingModuleService.updateProductListings({
      id: input.listingId,
      status: "approved",
      reviewed_by: input.adminUserId,
      reviewed_at: new Date(),
    })
    return new StepResponse(listing, input)
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
      reviewed_by: null,
      reviewed_at: null,
    })
  }
)

type PublishProductInput = { productId: string }

const publishProductStep = createStep(
  "publish-product",
  async (input: PublishProductInput, { container }) => {
    const productModuleService = container.resolve(Modules.PRODUCT)
    const product = await productModuleService.updateProducts(input.productId, {
      status: "published",
    })
    return new StepResponse(product, input.productId)
  },
  async (productId, { container }) => {
    if (!productId) {
      return
    }
    const productModuleService = container.resolve(Modules.PRODUCT)
    await productModuleService.updateProducts(productId, { status: "draft" })
  }
)

type RecordApprovalAuditLogInput = {
  adminUserId: string
  listingId: string
  vendorId: string
  previousStatus: ProductListingStatus
}

const recordProductApprovalAuditLogStep = createStep(
  "record-product-approval-audit-log",
  async (input: RecordApprovalAuditLogInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "user",
      actorId: input.adminUserId,
      action: "product_listing.approved",
      entityType: "product_listing",
      entityId: input.listingId,
      vendorId: input.vendorId,
      beforeState: { status: input.previousStatus },
      afterState: { status: "approved" },
    })
    return new StepResponse(auditLog)
  }
)

export type ApproveProductListingWorkflowInput = {
  listingId: string
  productId: string
  vendorId: string
  adminUserId: string
  previousStatus: ProductListingStatus
}

export const approveProductListingWorkflowId = "approve-product-listing"

export const approveProductListingWorkflow = createWorkflow(
  approveProductListingWorkflowId,
  (input: ApproveProductListingWorkflowInput) => {
    const listing = markListingApprovedStep({
      listingId: input.listingId,
      previousStatus: input.previousStatus,
      adminUserId: input.adminUserId,
    })

    const product = publishProductStep({ productId: input.productId })

    recordProductApprovalAuditLogStep({
      adminUserId: input.adminUserId,
      listingId: input.listingId,
      vendorId: input.vendorId,
      previousStatus: input.previousStatus,
    })

    return new WorkflowResponse({ listing, product })
  }
)
