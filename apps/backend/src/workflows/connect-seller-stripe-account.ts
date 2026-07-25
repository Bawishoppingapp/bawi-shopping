import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { createStripeConnectClient } from "../payments/stripe-client"

/**
 * Onboarding-link creation touches Stripe (account creation, at most once
 * per seller) and our own seller record (stripe_account_id) plus the audit
 * log - same atomicity reasoning as approve-product-listing.ts. If the
 * seller already has a stripe_account_id, this reuses it rather than
 * creating a second Stripe account (idempotent by design).
 */

type EnsureStripeAccountInput = { sellerId: string; existingStripeAccountId: string | null }
type EnsureStripeAccountCompensation = {
  sellerId: string
  createdNewAccount: boolean
  accountId: string | null
}

const ensureStripeAccountStep = createStep(
  "ensure-stripe-account",
  async (input: EnsureStripeAccountInput, { container }) => {
    const sellerModuleService: SellerModuleService = container.resolve(SELLER_MODULE)
    const stripeClient = createStripeConnectClient()

    if (input.existingStripeAccountId) {
      const compensation: EnsureStripeAccountCompensation = {
        sellerId: input.sellerId,
        createdNewAccount: false,
        accountId: null,
      }
      return new StepResponse(
        { accountId: input.existingStripeAccountId, createdNewAccount: false },
        compensation
      )
    }

    const account = await stripeClient.createExpressAccount()
    await sellerModuleService.updateSellers({
      id: input.sellerId,
      stripe_account_id: account.id,
    })

    const compensation: EnsureStripeAccountCompensation = {
      sellerId: input.sellerId,
      createdNewAccount: true,
      accountId: account.id,
    }
    return new StepResponse({ accountId: account.id, createdNewAccount: true }, compensation)
  },
  async (compensationInput, { container }) => {
    if (!compensationInput?.createdNewAccount || !compensationInput.accountId) {
      return
    }
    const sellerModuleService: SellerModuleService = container.resolve(SELLER_MODULE)
    const stripeClient = createStripeConnectClient()
    await sellerModuleService.updateSellers({
      id: compensationInput.sellerId,
      stripe_account_id: null,
    })
    try {
      await stripeClient.deleteAccount(compensationInput.accountId)
    } catch {
      // Best-effort - an orphaned test/dev Express account with no bank
      // details attached is not a security or financial risk; a failure
      // here must not block the rest of the rollback.
    }
  }
)

type CreateAccountLinkInput = { accountId: string; returnUrl: string; refreshUrl: string }

const createAccountLinkStep = createStep(
  "create-account-link",
  async (input: CreateAccountLinkInput) => {
    const stripeClient = createStripeConnectClient()
    const link = await stripeClient.createAccountLink({
      accountId: input.accountId,
      returnUrl: input.returnUrl,
      refreshUrl: input.refreshUrl,
    })
    return new StepResponse(link)
  }
)

type RecordAuditLogInput = { sellerId: string; adminOrSellerUserId: string }

const recordOnboardingLinkAuditLogStep = createStep(
  "record-onboarding-link-audit-log",
  async (input: RecordAuditLogInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "seller_user",
      actorId: input.adminOrSellerUserId,
      action: "seller.stripe_onboarding_link_created",
      entityType: "seller",
      entityId: input.sellerId,
      vendorId: input.sellerId,
    })
    return new StepResponse(auditLog)
  }
)

export type ConnectSellerStripeAccountWorkflowInput = {
  sellerId: string
  existingStripeAccountId: string | null
  sellerUserId: string
  returnUrl: string
  refreshUrl: string
}

export const connectSellerStripeAccountWorkflowId = "connect-seller-stripe-account"

export const connectSellerStripeAccountWorkflow = createWorkflow(
  connectSellerStripeAccountWorkflowId,
  (input: ConnectSellerStripeAccountWorkflowInput) => {
    const account = ensureStripeAccountStep({
      sellerId: input.sellerId,
      existingStripeAccountId: input.existingStripeAccountId,
    })

    const link = createAccountLinkStep({
      accountId: account.accountId,
      returnUrl: input.returnUrl,
      refreshUrl: input.refreshUrl,
    })

    recordOnboardingLinkAuditLogStep({
      sellerId: input.sellerId,
      adminOrSellerUserId: input.sellerUserId,
    })

    return new WorkflowResponse({ url: link.url })
  }
)
