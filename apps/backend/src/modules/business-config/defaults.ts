// Development/staging defaults only - see docs/DECISIONS.md. Every entry
// flagged is_placeholder: true stands in for a real business/legal/
// operational decision that must be explicitly replaced and approved
// before production launch (see check-production-readiness.ts). Entries
// flagged is_placeholder: false are genuine v1 scope decisions, not
// pending approvals - they don't need to change before launch.

export const FEATURE_FLAG_KEYS = [
  "live_payments_enabled",
  "real_transfers_enabled",
  "real_payouts_enabled",
  "real_refunds_enabled",
  "real_tax_calculation_enabled",
  "real_email_enabled",
  "real_sms_enabled",
  "real_courier_booking_enabled",
  "promotional_codes_enabled",
] as const

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number]

// Mirrors the `category` enum on the business_config_entry model - kept in
// sync manually since Medusa's model.enum() doesn't export its value list
// as a reusable type.
export type BusinessConfigCategory =
  | "commission"
  | "transfer_timing"
  | "returns"
  | "shipping"
  | "preparation"
  | "cancellation"
  | "service_area"
  | "brand_visibility"
  | "payment_methods"
  | "tax"
  | "courier"
  | "email"
  | "sms"
  | "support"
  | "cart"
  | "feature_flag"

export type DefaultConfigEntry = {
  category: BusinessConfigCategory
  key: string
  value: unknown
  value_type: "integer" | "boolean" | "string" | "json"
  label: string
  description?: string
  is_placeholder: boolean
  is_sensitive?: boolean
}

export const DEFAULT_BUSINESS_CONFIG_ENTRIES: DefaultConfigEntry[] = [
  {
    category: "commission",
    key: "platform_default_rate_basis_points",
    value: 1500,
    value_type: "integer",
    label: "Platform default commission rate (basis points)",
    description: "15.00% - resolution order is seller override -> category default -> this platform default.",
    is_placeholder: true,
  },
  {
    category: "transfer_timing",
    key: "transfer_hold_days",
    value: 7,
    value_type: "integer",
    label: "Seller transfer hold (days after confirmed delivery)",
    is_placeholder: true,
  },
  {
    category: "returns",
    key: "return_window_days",
    value: 14,
    value_type: "integer",
    label: "Customer return window (days after delivery)",
    is_placeholder: true,
  },
  {
    category: "returns",
    key: "return_shipping_policy",
    value: "customer_pays_unless_defective",
    value_type: "string",
    label: "Return shipping responsibility",
    description:
      "Customer pays return shipping unless the product is defective, damaged, incorrect, or materially different from the listing.",
    is_placeholder: true,
  },
  {
    category: "shipping",
    key: "standard_shipping_fee_cents",
    value: 699,
    value_type: "integer",
    label: "Standard shipping fee (cents)",
    is_placeholder: true,
  },
  {
    category: "shipping",
    key: "free_shipping_threshold_cents",
    value: 7500,
    value_type: "integer",
    label: "Free-shipping threshold (cents per order)",
    is_placeholder: true,
  },
  {
    category: "preparation",
    key: "seller_preparation_deadline_hours",
    value: 48,
    value_type: "integer",
    label: "Seller preparation deadline (hours)",
    is_placeholder: true,
  },
  {
    category: "cancellation",
    key: "cancellation_cutoff",
    value: "preparing",
    value_type: "string",
    label: "Cancellation allowed until",
    description: "Customer may cancel until the seller marks the fulfillment order as preparing.",
    is_placeholder: true,
  },
  {
    category: "service_area",
    key: "initial_service_area",
    value: "Dallas-Fort Worth, Texas",
    value_type: "string",
    label: "Initial service area",
    is_placeholder: true,
  },
  {
    category: "brand_visibility",
    key: "vendor_brand_requires_approval",
    value: true,
    value_type: "boolean",
    label: "Vendor-owned store name/brand requires Bawi approval to display publicly",
    is_placeholder: false,
  },
  {
    category: "payment_methods",
    key: "currency",
    value: "USD",
    value_type: "string",
    label: "Currency",
    is_placeholder: false,
  },
  {
    category: "payment_methods",
    key: "accepted_methods",
    value: ["stripe_test_cards", "stripe_test_wallets"],
    value_type: "json",
    label: "Accepted payment methods (test mode)",
    is_placeholder: false,
  },
  {
    category: "tax",
    key: "provider",
    value: "mock",
    value_type: "string",
    label: "Tax provider",
    description: "Mock tax-calculation adapter until a real provider is selected and real_tax_calculation_enabled is turned on.",
    is_placeholder: true,
  },
  {
    category: "tax",
    key: "mock_rate_basis_points",
    value: 825,
    value_type: "integer",
    label: "Mock tax rate (basis points)",
    description: "8.25% - a plausible flat placeholder for the initial Dallas-Fort Worth service area, applied uniformly regardless of the shipping address until a real tax provider (e.g. rate-by-jurisdiction) replaces this adapter.",
    is_placeholder: true,
  },
  {
    category: "courier",
    key: "provider",
    value: "mock_bawi_courier",
    value_type: "string",
    label: "Courier provider",
    description: "Internal mock courier adapter until a real provider is selected and real_courier_booking_enabled is turned on.",
    is_placeholder: true,
  },
  {
    category: "email",
    key: "provider",
    value: "mock_local",
    value_type: "string",
    label: "Email provider",
    description: "Local/test email adapter until a real provider is selected and real_email_enabled is turned on.",
    is_placeholder: true,
  },
  {
    category: "sms",
    key: "provider",
    value: "mock_disabled",
    value_type: "string",
    label: "SMS provider",
    description: "Mock delivery only, never a real phone number, until real_sms_enabled is turned on.",
    is_placeholder: true,
  },
  {
    category: "support",
    key: "support_email",
    value: "support@example.bawishopping.com",
    value_type: "string",
    label: "Customer support email",
    is_placeholder: true,
  },
  {
    category: "support",
    key: "support_phone",
    value: "+1-555-0100-TEST",
    value_type: "string",
    label: "Customer support phone",
    description: "A clearly fake test value - never a real phone number.",
    is_placeholder: true,
  },
  {
    category: "cart",
    key: "cart_expiration_days",
    value: 30,
    value_type: "integer",
    label: "Cart expiration (days of inactivity)",
    description: "A cart untouched for this many days is treated as abandoned; a new cart is started transparently rather than reusing stale line items.",
    is_placeholder: false,
  },
  {
    category: "cart",
    key: "max_quantity_per_line_item",
    value: 10,
    value_type: "integer",
    label: "Maximum quantity per cart line item",
    is_placeholder: false,
  },
  ...FEATURE_FLAG_KEYS.map(
    (key): DefaultConfigEntry => ({
      category: "feature_flag",
      key,
      value: false,
      value_type: "boolean",
      label: key,
      description: "Gates a code path that would otherwise move real money, send a real communication, or book a real courier. Never true by default.",
      is_placeholder: false,
      is_sensitive: true,
    })
  ),
]
