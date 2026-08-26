import "server-only"
import { cookies } from "next/headers"
import { CUSTOMER_SESSION_COOKIE } from "@/features/auth/constants"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"
const MEDUSA_PUBLISHABLE_KEY = process.env.MEDUSA_PUBLISHABLE_KEY ?? ""

export class AddressesClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AddressesClientError"
  }
}

export interface CustomerAddress {
  id: string
  address_name: string | null
  first_name: string | null
  last_name: string | null
  company: string | null
  address_1: string | null
  address_2: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  country_code: string | null
  phone: string | null
  is_default_shipping: boolean
  is_default_billing: boolean
}

export interface AddressInput {
  address_name?: string
  first_name: string
  last_name: string
  company?: string
  address_1: string
  address_2?: string
  city: string
  province?: string
  postal_code?: string
  country_code: string
  phone?: string
  is_default_shipping?: boolean
  is_default_billing?: boolean
}

async function authHeaders(): Promise<Record<string, string>> {
  const cookieStore = await cookies()
  const customerToken = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value
  if (!customerToken) {
    throw new AddressesClientError("Not authenticated")
  }
  return {
    "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY,
    Authorization: `Bearer ${customerToken}`,
    "Content-Type": "application/json",
  }
}

async function parseJson(response: Response) {
  const text = await response.text()
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

export async function listAddresses(): Promise<CustomerAddress[]> {
  const headers = await authHeaders()
  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/customers/me/addresses`, {
    headers,
    cache: "no-store",
  })
  const data = await parseJson(response)
  if (!response.ok) {
    return []
  }
  return data.addresses as CustomerAddress[]
}

export async function createAddress(input: AddressInput): Promise<void> {
  const headers = await authHeaders()
  const response = await fetch(`${MEDUSA_BACKEND_URL}/store/customers/me/addresses`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
    cache: "no-store",
  })
  const data = await parseJson(response)
  if (!response.ok) {
    throw new AddressesClientError(data.message || "Could not save this address")
  }
}

export async function deleteAddress(addressId: string): Promise<void> {
  const headers = await authHeaders()
  const response = await fetch(
    `${MEDUSA_BACKEND_URL}/store/customers/me/addresses/${addressId}`,
    { method: "DELETE", headers, cache: "no-store" }
  )
  const data = await parseJson(response)
  if (!response.ok) {
    throw new AddressesClientError(data.message || "Could not remove this address")
  }
}
