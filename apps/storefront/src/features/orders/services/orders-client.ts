import "server-only"
import { cookies } from "next/headers"
import { CUSTOMER_SESSION_COOKIE } from "@/features/auth/constants"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"
const MEDUSA_PUBLISHABLE_KEY = process.env.MEDUSA_PUBLISHABLE_KEY ?? ""

export interface OrderSummary {
  id: string
  display_id: string
  status: string
  total: number
  currency_code: string
  created_at: string
}

export interface OrderItem {
  id: string
  product_code: string | null
  title: string
  thumbnail: string | null
  color: string | null
  size: string | null
  unit_price: number
  quantity: number
  line_total: number
}

export interface OrderVendorOrderTimeline {
  preparing_at: string | null
  ready_for_pickup_at: string | null
  picked_up_at: string | null
  out_for_delivery_at: string | null
  delivered_at: string | null
}

export interface OrderVendorOrder {
  id: string
  brand: string
  status: string
  fulfillment_code: string
  subtotal: number
  shipping: number
  tax: number
  total: number
  items: OrderItem[]
  timeline: OrderVendorOrderTimeline
  delivery_confirmation_code: string | null
}

export interface OrderDetail {
  id: string
  display_id: string
  status: string
  payment_status: string
  currency_code: string
  subtotal: number
  shipping: number
  tax: number
  total: number
  shipping_address: Record<string, unknown>
  vendor_orders: OrderVendorOrder[]
  created_at: string
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const cookieStore = await cookies()
  const customerToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value
  if (!customerToken) {
    return null
  }
  return {
    "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
    Authorization: `Bearer ${customerToken}`,
  }
}

export async function listOrders(): Promise<OrderSummary[]> {
  const headers = await authHeaders()
  if (!headers) {
    return []
  }
  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/orders`, {
    headers,
    cache: "no-store",
  })
  if (!response.ok) {
    return []
  }
  const data = await response.json()
  return data.orders as OrderSummary[]
}

export async function getOrder(orderId: string): Promise<OrderDetail | null> {
  const headers = await authHeaders()
  if (!headers) {
    return null
  }
  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/orders/${orderId}`, {
    headers,
    cache: "no-store",
  })
  if (!response.ok) {
    return null
  }
  const data = await response.json()
  return data.order as OrderDetail
}
