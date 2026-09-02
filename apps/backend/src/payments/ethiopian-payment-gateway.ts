import { MedusaError } from "@medusajs/framework/utils"

export type EthiopianPaymentStatus =
  | "pending"
  | "requires_customer_action"
  | "authorized"
  | "captured"
  | "failed"
  | "cancelled"
  | "refunded"

export interface EthiopianPaymentRequest {
  amountMinor: number
  currency: "ETB"
  merchantReference: string
  idempotencyKey: string
  returnUrl: string
  callbackUrl: string
  customer: { email?: string; phone?: string }
  metadata: Record<string, string>
}

export interface EthiopianPaymentResult {
  providerReference: string
  status: EthiopianPaymentStatus
  checkoutUrl?: string
  customerAction?: Record<string, string>
}

export interface EthiopianRefundRequest {
  providerReference: string
  amountMinor: number
  idempotencyKey: string
  reason?: string
}

export interface EthiopianPaymentWebhook {
  eventId: string
  providerReference: string
  status: EthiopianPaymentStatus
  raw: unknown
}

/**
 * Provider-neutral boundary for an Ethiopian bank, switch, or wallet API.
 * A provider implementation must map its proprietary request, status, and
 * signature formats to this contract. Keeping it behind this interface lets
 * checkout and order workflows stay unchanged when the bank is selected.
 */
export interface EthiopianPaymentGateway {
  readonly providerId: string
  createPayment(input: EthiopianPaymentRequest): Promise<EthiopianPaymentResult>
  getPayment(providerReference: string): Promise<EthiopianPaymentResult>
  cancelPayment(providerReference: string, idempotencyKey: string): Promise<void>
  refundPayment(input: EthiopianRefundRequest): Promise<EthiopianPaymentResult>
  verifyWebhook(payload: string | Buffer, signature: string | undefined): EthiopianPaymentWebhook
}

type GatewayFactory = () => EthiopianPaymentGateway
const registeredProviders = new Map<string, GatewayFactory>()

/** Register a selected bank's adapter during backend startup. */
export function registerEthiopianPaymentProvider(providerId: string, factory: GatewayFactory): void {
  const normalized = providerId.trim().toLowerCase()
  if (!normalized || normalized === "disabled") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "A real payment provider id is required")
  }
  registeredProviders.set(normalized, factory)
}

/**
 * Payments fail closed until a bank adapter is registered and explicitly
 * selected. This never falls back to a mock or silently enables real money.
 */
export function createEthiopianPaymentGateway(
  providerId = process.env.ETHIOPIAN_PAYMENT_PROVIDER ?? "disabled"
): EthiopianPaymentGateway {
  const normalized = providerId.trim().toLowerCase()
  if (normalized === "disabled") {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "Ethiopian payments are disabled until an approved bank provider and credentials are configured."
    )
  }

  const factory = registeredProviders.get(normalized)
  if (!factory) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Ethiopian payment provider '${normalized}' has no installed adapter.`
    )
  }
  return factory()
}

