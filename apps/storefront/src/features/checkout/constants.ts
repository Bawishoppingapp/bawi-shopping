export interface ShippingAddress {
  first_name: string
  last_name: string
  address_1: string
  address_2?: string
  city: string
  province?: string
  postal_code?: string
  country_code: string
  phone: string
}

export interface CheckoutStartResult {
  order_id: string
  display_id: string
  status: string
  payment_status: string
  payment_method: "manual_telebirr"
  payment_recipient_name: string | null
  payment_recipient_phone: string | null
  subtotal: number
  shipping: number | null
  tax: number
  total: number | null
  currency_code: string
}

export interface CheckoutActionState {
  status: "idle" | "error"
  fieldErrors: Partial<
    Record<
      | "firstName"
      | "lastName"
      | "address1"
      | "city"
      | "province"
      | "postalCode"
      | "countryCode"
      | "phone",
      string
    >
  >
  formError?: string
  result?: CheckoutStartResult
}

export const initialCheckoutState: CheckoutActionState = { status: "idle", fieldErrors: {} }
