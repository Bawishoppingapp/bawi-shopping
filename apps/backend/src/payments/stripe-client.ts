import Stripe from "stripe"
import crypto from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"

export interface StripeConnectEvent {
  id: string
  type: string
  data: { object: Record<string, unknown> }
}

/**
 * The minimal surface this codebase needs from Stripe - narrower than the
 * full SDK on purpose, so a test double can satisfy the same interface
 * without pulling in Stripe's entire type surface. Every real Stripe call
 * this platform makes (onboarding, and later transfers/refunds/disputes)
 * goes through an interface shaped like this one, never a bare `new
 * Stripe(...)` scattered across route/workflow files - see
 * docs/DECISIONS.md.
 */
export interface StripeConnectClient {
  createExpressAccount(): Promise<{ id: string }>
  createAccountLink(input: {
    accountId: string
    returnUrl: string
    refreshUrl: string
  }): Promise<{ url: string }>
  deleteAccount(accountId: string): Promise<void>
  constructWebhookEvent(
    payload: string | Buffer,
    signature: string | undefined,
    webhookSecret: string
  ): StripeConnectEvent
}

class RealStripeConnectClient implements StripeConnectClient {
  private readonly stripe: Stripe

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey)
  }

  async createExpressAccount(): Promise<{ id: string }> {
    const account = await this.stripe.accounts.create({ type: "express" })
    return { id: account.id }
  }

  async createAccountLink(input: {
    accountId: string
    returnUrl: string
    refreshUrl: string
  }): Promise<{ url: string }> {
    const link = await this.stripe.accountLinks.create({
      account: input.accountId,
      return_url: input.returnUrl,
      refresh_url: input.refreshUrl,
      type: "account_onboarding",
    })
    return { url: link.url }
  }

  async deleteAccount(accountId: string): Promise<void> {
    await this.stripe.accounts.del(accountId)
  }

  constructWebhookEvent(
    payload: string | Buffer,
    signature: string | undefined,
    webhookSecret: string
  ): StripeConnectEvent {
    if (!signature) {
      throw new MedusaError(MedusaError.Types.UNAUTHORIZED, "Missing Stripe-Signature header")
    }
    const event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret)
    return {
      id: event.id,
      type: event.type,
      data: { object: event.data.object as unknown as Record<string, unknown> },
    }
  }
}

/**
 * Test-support only (see apps/backend/src/api/seller-test-support for the
 * same gating precedent). No real network call, no real crypto signature
 * verification - a test posts { testSignature: "test-signature" } instead
 * of a real Stripe-Signature header, and this client trusts it because
 * it's only ever reachable when ENABLE_TEST_SUPPORT_ROUTES=true. A
 * module-level singleton so an account created in one request is still
 * known to a later request in the same test run (mirroring how a real
 * Stripe account persists across requests).
 */
class FakeStripeConnectClient implements StripeConnectClient {
  private readonly accountIds = new Set<string>()

  async createExpressAccount(): Promise<{ id: string }> {
    const id = `acct_test_${crypto.randomBytes(8).toString("hex")}`
    this.accountIds.add(id)
    return { id }
  }

  async createAccountLink(input: {
    accountId: string
    returnUrl: string
    refreshUrl: string
  }): Promise<{ url: string }> {
    if (!this.accountIds.has(input.accountId)) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Unknown test Stripe account: ${input.accountId}`
      )
    }
    return { url: `https://connect.stripe.com/test/setup/${input.accountId}` }
  }

  async deleteAccount(accountId: string): Promise<void> {
    this.accountIds.delete(accountId)
  }

  constructWebhookEvent(payload: string | Buffer, signature: string | undefined): StripeConnectEvent {
    if (signature !== "test-signature") {
      throw new MedusaError(
        MedusaError.Types.UNAUTHORIZED,
        "Invalid or missing test Stripe signature"
      )
    }
    const parsed = JSON.parse(typeof payload === "string" ? payload : payload.toString("utf8"))
    return { id: parsed.id, type: parsed.type, data: { object: parsed.data.object } }
  }
}

let sharedFakeClient: FakeStripeConnectClient | undefined

function isTestSupportEnabled(): boolean {
  return process.env.ENABLE_TEST_SUPPORT_ROUTES === "true"
}

/**
 * Real Stripe client when STRIPE_SECRET_KEY is configured; a fake,
 * network-free client when it isn't AND test-support routes are
 * explicitly enabled; throws otherwise. There is no path where a real
 * environment silently falls back to the fake - see docs/DECISIONS.md
 * ("Stripe test mode only, until an explicit production-launch
 * approval").
 */
export function createStripeConnectClient(): StripeConnectClient {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (secretKey) {
    return new RealStripeConnectClient(secretKey)
  }
  if (isTestSupportEnabled()) {
    if (!sharedFakeClient) {
      sharedFakeClient = new FakeStripeConnectClient()
    }
    return sharedFakeClient
  }
  throw new MedusaError(
    MedusaError.Types.UNEXPECTED_STATE,
    "Stripe is not configured: set STRIPE_SECRET_KEY (test mode) or enable ENABLE_TEST_SUPPORT_ROUTES for local/test use."
  )
}
