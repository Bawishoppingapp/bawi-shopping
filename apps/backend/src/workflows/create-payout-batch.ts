import {
  createStep,
  createWorkflow,
  StepResponse,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { SELLER_FINANCE_MODULE } from "../modules/seller-finance"
import type SellerFinanceModuleService from "../modules/seller-finance/service"
import { SELLER_MODULE } from "../modules/seller"
import type SellerModuleService from "../modules/seller/service"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"
import { createStripePaymentClient } from "../payments/stripe-payment-client"
import { deriveLedgerBucket } from "../finance/balance"

/**
 * Admin-triggered payout batch for one seller - there's no background job
 * scheduler in this project yet (see docs/DECISIONS.md), so this is a
 * manual action, not a real cron. Selects every "available" ledger entry
 * (past its transfer-hold window, not disputed, not yet paid) for the
 * seller, creates one Stripe Transfer for the sum, and marks every
 * selected entry paid - all inside one atomic step, so a re-run can never
 * double-select an entry already claimed by a `PayoutLineItem` (unique on
 * `commission_ledger_entry_id`).
 */

type SelectEntriesInput = { vendorId: string }

const selectEligibleEntriesStep = createStep(
  "select-eligible-entries",
  async (input: SelectEntriesInput, { container }) => {
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    const allEntries = await sellerFinanceModuleService.listCommissionLedgerEntries({
      vendor_id: input.vendorId,
    })
    const alreadyPaidLineItems = await sellerFinanceModuleService.listPayoutLineItems({
      commission_ledger_entry_id: allEntries.map((entry) => entry.id),
    })
    const alreadyPaidIds = new Set(
      alreadyPaidLineItems.map((lineItem) => lineItem.commission_ledger_entry_id)
    )

    const eligible = allEntries.filter(
      (entry) => !alreadyPaidIds.has(entry.id) && deriveLedgerBucket(entry) === "available"
    )
    return new StepResponse(eligible)
  }
)

type LedgerEntryForPayout = { id: string; net_amount: number }
type CreateTransferInput = { vendorId: string; entries: LedgerEntryForPayout[] }
type CreateTransferCompensation = { payoutId: string; wasNewlyCreated: boolean }

const createPayoutAndTransferStep = createStep(
  "create-payout-and-transfer",
  async (input: CreateTransferInput, { container }) => {
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    const sellerModuleService: SellerModuleService = container.resolve(SELLER_MODULE)

    if (!input.entries.length) {
      return new StepResponse(null, null)
    }

    const seller = await sellerModuleService.retrieveSeller(input.vendorId)
    if (!seller.stripe_account_id || !seller.stripe_payouts_enabled) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Seller's Stripe account is not enabled for payouts"
      )
    }

    const totalAmount = input.entries.reduce((sum, entry) => sum + entry.net_amount, 0)

    // Idempotent by construction: keyed on the exact sorted set of entry
    // ids, so retrying the same batch (e.g. a network retry) reuses the
    // same Stripe idempotency key rather than creating a second Transfer.
    const idempotencyKey = `payout-${input.vendorId}-${input.entries
      .map((entry) => entry.id)
      .sort()
      .join(",")}`

    const paymentClient = createStripePaymentClient()
    const transfer = await paymentClient.createTransfer({
      amountCents: totalAmount,
      currency: "usd",
      destinationAccountId: seller.stripe_account_id,
      idempotencyKey,
      metadata: { vendor_id: input.vendorId },
    })

    const payout = await sellerFinanceModuleService.createPayouts({
      vendor_id: input.vendorId,
      idempotency_key: idempotencyKey,
      amount: totalAmount,
      status: "paid",
      stripe_transfer_id: transfer.id,
    })

    await sellerFinanceModuleService.createPayoutLineItems(
      input.entries.map((entry) => ({
        payout_id: payout.id,
        commission_ledger_entry_id: entry.id,
        amount: entry.net_amount,
      }))
    )

    const compensation: CreateTransferCompensation = { payoutId: payout.id, wasNewlyCreated: true }
    return new StepResponse(payout, compensation)
  },
  async (compensationInput, { container }) => {
    if (!compensationInput?.wasNewlyCreated) {
      return
    }
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    const lineItems = await sellerFinanceModuleService.listPayoutLineItems({
      payout_id: compensationInput.payoutId,
    })
    if (lineItems.length) {
      await sellerFinanceModuleService.deletePayoutLineItems(lineItems.map((li) => li.id))
    }
    await sellerFinanceModuleService.deletePayouts([compensationInput.payoutId])
  }
)

type MarkEntriesPaidInput = { entryIds: string[] }

const markEntriesPaidStep = createStep(
  "mark-entries-paid",
  async (input: MarkEntriesPaidInput, { container }) => {
    if (!input.entryIds.length) {
      return new StepResponse([])
    }
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    const paidAt = new Date()
    for (const entryId of input.entryIds) {
      await sellerFinanceModuleService.updateCommissionLedgerEntries({
        id: entryId,
        paid_at: paidAt,
      })
    }
    return new StepResponse(input.entryIds, input.entryIds)
  },
  async (entryIds, { container }) => {
    if (!entryIds?.length) {
      return
    }
    const sellerFinanceModuleService: SellerFinanceModuleService = container.resolve(
      SELLER_FINANCE_MODULE
    )
    for (const entryId of entryIds) {
      await sellerFinanceModuleService.updateCommissionLedgerEntries({
        id: entryId,
        paid_at: null,
      })
    }
  }
)

type RecordAuditLogInput = { vendorId: string; adminUserId: string; amount: number }

const recordPayoutAuditLogStep = createStep(
  "record-payout-audit-log",
  async (input: RecordAuditLogInput, { container }) => {
    const auditLogModuleService: AuditLogModuleService = container.resolve(AUDIT_LOG_MODULE)
    const auditLog = await auditLogModuleService.record({
      actorType: "user",
      actorId: input.adminUserId,
      action: "payout.created",
      entityType: "seller",
      entityId: input.vendorId,
      vendorId: input.vendorId,
      afterState: { amount: input.amount },
    })
    return new StepResponse(auditLog)
  }
)

export type CreatePayoutBatchWorkflowInput = { vendorId: string; adminUserId: string }

export const createPayoutBatchWorkflowId = "create-payout-batch"

export const createPayoutBatchWorkflow = createWorkflow(
  createPayoutBatchWorkflowId,
  (input: CreatePayoutBatchWorkflowInput) => {
    const eligibleEntries = selectEligibleEntriesStep({ vendorId: input.vendorId })

    const entries = transform(
      { eligibleEntries },
      ({ eligibleEntries }) =>
        eligibleEntries.map((entry: { id: string; net_amount: number }) => ({
          id: entry.id,
          net_amount: entry.net_amount,
        }))
    )
    const entryIds = transform({ eligibleEntries }, ({ eligibleEntries }) =>
      eligibleEntries.map((entry: { id: string }) => entry.id)
    )
    const totalAmount = transform({ eligibleEntries }, ({ eligibleEntries }) =>
      eligibleEntries.reduce(
        (sum: number, entry: { net_amount: number }) => sum + entry.net_amount,
        0
      )
    )

    const payout = createPayoutAndTransferStep({
      vendorId: input.vendorId,
      entries,
    })

    markEntriesPaidStep({ entryIds })

    recordPayoutAuditLogStep({
      vendorId: input.vendorId,
      adminUserId: input.adminUserId,
      amount: totalAmount,
    })

    return new WorkflowResponse(payout)
  }
)
