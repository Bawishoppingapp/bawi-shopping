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
  | "legal"
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
    value: 1000,
    value_type: "integer",
    label: "Platform default commission rate (basis points)",
    description: "10.00% customer-price markup. Seller-entered prices remain the seller's earnings; customers see only the marked-up retail price.",
    is_placeholder: false,
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
    value: 0,
    value_type: "integer",
    label: "Customer return window (days after delivery)",
    description: "Returns are disabled for the initial launch. A future policy change must explicitly set a positive window.",
    is_placeholder: false,
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
    label: "Standard shipping fee, USD sellers (cents)",
    is_placeholder: true,
  },
  {
    category: "shipping",
    key: "neighboring_shipping_fee_cents_etb",
    value: 25000,
    value_type: "integer",
    label: "Neighboring Addis Ababa delivery fee, ETB cents",
    description: "ETB 250 for Burayu, Sebeta, Sululta, Legetafo/Legedadi, and Bishoftu.",
    is_placeholder: false,
  },
  {
    category: "shipping",
    key: "free_shipping_threshold_cents",
    value: 7500,
    value_type: "integer",
    label: "Free-shipping threshold, USD sellers (cents per order)",
    is_placeholder: true,
  },
  // Separate ETB entries, not a rename of the two above - each currency's
  // fee/threshold is a real, independent business decision, not a live
  // FX conversion of the other (see docs/DECISIONS.md's Ethiopian-market
  // entry). Same minor-unit convention as every other money field in this
  // system (hundredths), so a formatter just picks the right key by
  // currency rather than special-casing storage per currency.
  {
    category: "shipping",
    key: "standard_shipping_fee_cents_etb",
    value: 15000,
    value_type: "integer",
    label: "Standard shipping fee, ETB sellers (cents)",
    description: "ETB 150 flat delivery inside Addis Ababa.",
    is_placeholder: false,
  },
  {
    category: "shipping",
    key: "free_shipping_threshold_cents_etb",
    value: 300000,
    value_type: "integer",
    label: "Free-shipping threshold, ETB sellers (cents per order)",
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
    value: "picked_up",
    value_type: "string",
    label: "Cancellation allowed until",
    description: "Customer may cancel before the courier confirms pickup. A verified manual payment requires an offline refund.",
    is_placeholder: false,
  },
  {
    category: "service_area",
    key: "initial_service_area",
    value: "Addis Ababa; Burayu; Sebeta; Sululta; Legetafo/Legedadi; Bishoftu",
    value_type: "string",
    label: "Initial service area",
    is_placeholder: false,
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
    value: "ETB",
    value_type: "string",
    label: "Currency",
    is_placeholder: false,
  },
  {
    category: "payment_methods",
    key: "accepted_methods",
    value: ["manual_telebirr"],
    value_type: "json",
    label: "Accepted payment methods",
    is_placeholder: false,
  },
  {
    category: "payment_methods",
    key: "telebirr_recipient_name",
    value: "Bantalem Yirga",
    value_type: "string",
    label: "Telebirr recipient name",
    description: "Verified Telebirr recipient name shown to customers during checkout.",
    is_placeholder: false,
  },
  {
    category: "payment_methods",
    key: "telebirr_recipient_phone",
    value: "+251911385693",
    value_type: "string",
    label: "Telebirr merchant phone number",
    description: "Verified Telebirr transfer number shown to customers during checkout.",
    is_placeholder: false,
    is_sensitive: false,
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
    value: 0,
    value_type: "integer",
    label: "Mock tax rate (basis points)",
    description: "No customer tax is charged in the initial launch configuration. Revisit with Ethiopian tax counsel before changing.",
    is_placeholder: false,
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
    value: "support@bawishopping.com",
    value_type: "string",
    label: "Customer support email",
    is_placeholder: false,
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
  {
    category: "legal",
    key: "company_legal_name",
    value: "Bawi Shopping, Inc. (placeholder - not a real registered entity)",
    value_type: "string",
    label: "Company legal name",
    description: "The registered legal entity name used in Terms of Service, Privacy Policy, and every other legal document - see docs/legal/.",
    is_placeholder: true,
  },
  {
    category: "legal",
    key: "company_address",
    value: "123 Placeholder St, Suite 100, Dallas, TX 75201, USA",
    value_type: "string",
    label: "Company registered address",
    description: "Used in legal documents and any required physical-address disclosure.",
    is_placeholder: true,
  },
  {
    category: "legal",
    key: "registered_agent_state",
    value: "Texas",
    value_type: "string",
    label: "State of incorporation / registered agent state",
    is_placeholder: true,
  },
  {
    category: "legal",
    key: "dmca_agent_email",
    value: "dmca@example.bawishopping.com",
    value_type: "string",
    label: "DMCA/copyright agent contact email",
    description: "Used in docs/legal/DMCA-POLICY.md - a real DMCA agent should also be registered with the U.S. Copyright Office before launch.",
    is_placeholder: true,
  },
  {
    category: "legal",
    key: "privacy_contact_email",
    value: "privacy@example.bawishopping.com",
    value_type: "string",
    label: "Privacy/data-subject-request contact email",
    is_placeholder: true,
  },
  {
    category: "legal",
    key: "terms_last_updated",
    value: "2026-07-29",
    value_type: "string",
    label: "Terms of Service / Privacy Policy last-updated date",
    description: "Must be updated every time docs/legal/TERMS-OF-SERVICE.md or PRIVACY-POLICY.md materially changes.",
    is_placeholder: true,
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
