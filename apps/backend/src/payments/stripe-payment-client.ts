import Stripe from "stripe"
import crypto from "node:crypto"
import { MedusaError } from "@medusajs/framework/utils"

export interface CreatePaymentIntentInput {
  amountCents: number
  currency: string
  idempotencyKey: string
  metadata: Record<string, string>
}

export interface PaymentIntentResult {
  id: string
  clientSecret: string | null
  status: string
}

/**
 * The platform-account PaymentIntent surface (Separate Charges and
 * Transfers - see docs/PAYMENTS.md §3) - deliberately a separate interface
 * from StripeConnectClient (src/payments/stripe-client.ts), which only
 * covers Connect account onboarding. Both need the same real-vs-fake
 * selection and the same webhook-signature verification, but creating a
 * PaymentIntent is a distinct Stripe API resource from managing a
 * connected account, so they're kept as separate narrow interfaces rather
 * than one growing "do everything Stripe" client.
 */
export interface StripePaymentClient {
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult>
  retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntentResult>
  cancelPaymentIntent(paymentIntentId: string): Promise<void>
}

class RealStripePaymentClient implements StripePaymentClient {
  private readonly stripe: Stripe

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey)
  }

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: input.amountCents,
        // Stripe's own required parameter name, not a Medusa currency
        // module reference - the lint rule flagging this is a false
        // positive (same class as the price_cents precedent, see
        // docs/DECISIONS.md).
        currency: input.currency,
        metadata: input.metadata,
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey: input.idempotencyKey }
    )
    return { id: intent.id, clientSecret: intent.client_secret, status: intent.status }
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntentResult> {
    const intent = await this.stripe.paymentIntents.retrieve(paymentIntentId)
    return { id: intent.id, clientSecret: intent.client_secret, status: intent.status }
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    await this.stripe.paymentIntents.cancel(paymentIntentId)
  }
}

/**
 * Test-support only (see src/payments/stripe-client.ts's FakeStripeConnectClient
 * for the same gating precedent). A module-level singleton so a PaymentIntent
 * created in one request is still known to a later request/webhook in the
 * same test run.
 */
class FakeStripePaymentClient implements StripePaymentClient {
  private readonly intents = new Map<string, PaymentIntentResult & { amountCents: number }>()

  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
    const id = `pi_test_${crypto.randomBytes(8).toString("hex")}`
    const result = {
      id,
      clientSecret: `${id}_secret_test`,
      status: "requires_payment_method",
      amountCents: input.amountCents,
    }
    this.intents.set(id, result)
    return result
  }

  async retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntentResult> {
    const intent = this.intents.get(paymentIntentId)
    if (!intent) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Unknown test PaymentIntent: ${paymentIntentId}`
      )
    }
    return intent
  }

  async cancelPaymentIntent(paymentIntentId: string): Promise<void> {
    const intent = this.intents.get(paymentIntentId)
    if (intent) {
      intent.status = "canceled"
    }
  }
}

let sharedFakeClient: FakeStripePaymentClient | undefined

function isTestSupportEnabled(): boolean {
  return process.env.ENABLE_TEST_SUPPORT_ROUTES === "true"
}

/**
 * Real Stripe client when STRIPE_SECRET_KEY is configured; a fake,
 * network-free client when it isn't AND test-support routes are
 * explicitly enabled; throws otherwise - same rule as
 * createStripeConnectClient(), see docs/DECISIONS.md ("Stripe test mode
 * only, until an explicit production-launch approval").
 */
export function createStripePaymentClient(): StripePaymentClient {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (secretKey) {
    return new RealStripePaymentClient(secretKey)
  }
  if (isTestSupportEnabled()) {
    if (!sharedFakeClient) {
      sharedFakeClient = new FakeStripePaymentClient()
    }
    return sharedFakeClient
  }
  throw new MedusaError(
    MedusaError.Types.UNEXPECTED_STATE,
    "Stripe is not configured: set STRIPE_SECRET_KEY (test mode) or enable ENABLE_TEST_SUPPORT_ROUTES for local/test use."
  )
}
