export const CART_ID_COOKIE = "bawi_cart_id"
export const CART_ID_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90

export interface CartWarning {
  line_item_id: string
  code: "unavailable" | "quantity_exceeds_inventory" | "price_changed"
  message: string
}

export interface CartItem {
  id: string
  variant_id: string | null
  product_code: string | null
  title: string
  thumbnail: string | null
  brand: string | null
  color: string | null
  size: string | null
  quantity: number
  unit_price: number
  line_total: number
  available_quantity: number
  is_available: boolean
  max_quantity: number
}

export interface Cart {
  id: string
  currency_code: string
  items: CartItem[]
  item_count: number
  subtotal: number
  shipping_estimate: number
  free_shipping_threshold: number
  amount_remaining_for_free_shipping: number
  qualifies_for_free_shipping: boolean
  checkout_blocked: boolean
  warnings: CartWarning[]
}

export interface CartActionState {
  status: "idle" | "error"
  formError?: string
}

export const initialCartActionState: CartActionState = { status: "idle" }
