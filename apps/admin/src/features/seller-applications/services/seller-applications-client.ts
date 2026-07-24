import "server-only"

const MEDUSA_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export class SellerApplicationsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SellerApplicationsError"
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

export interface SellerApplication {
  id: string
  legal_business_name: string
  store_name: string
  business_type: string
  business_description: string
  estimated_product_count: number
  product_categories: string[]
  address: {
    line1: string
    line2?: string
    city: string
    state: string
    postal_code: string
    country: string
  }
  contact_first_name: string
  contact_last_name: string
  business_email: string
  phone_number: string
  website_url: string | null
  agreed_to_terms: boolean
  submitted_at: string
  status:
    | "draft"
    | "submitted"
    | "under_review"
    | "approved"
    | "rejected"
    | "withdrawn"
  rejection_reason: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  seller_id: string | null
}

export async function listSellerApplications(
  sessionToken: string,
  status?: string
): Promise<{ applications: SellerApplication[]; count: number }> {
  const url = new URL(`${MEDUSA_BACKEND_URL}/admin/seller-applications`)
  if (status) {
    url.searchParams.set("status", status)
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${sessionToken}` },
    cache: "no-store",
  })

  if (!response.ok) {
    throw new SellerApplicationsError("Could not load applications")
  }

  return (await parseJson(response)) as {
    applications: SellerApplication[]
    count: number
  }
}

export async function getSellerApplication(
  sessionToken: string,
  id: string
): Promise<SellerApplication | null> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/admin/seller-applications/${id}`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
    cache: "no-store",
  })

  if (!response.ok) {
    return null
  }

  const data = await parseJson(response)
  return data.application as SellerApplication
}

export async function approveSellerApplication(
  sessionToken: string,
  id: string
): Promise<{ activation_link?: string }> {
  const response = await fetch(
    `${MEDUSA_BACKEND_URL}/admin/seller-applications/${id}/approve`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${sessionToken}` },
    }
  )

  const data = await parseJson(response)

  if (!response.ok) {
    throw new SellerApplicationsError(data.message || "Could not approve application")
  }

  return data
}

export async function rejectSellerApplication(
  sessionToken: string,
  id: string,
  reason: string
): Promise<void> {
  const response = await fetch(
    `${MEDUSA_BACKEND_URL}/admin/seller-applications/${id}/reject`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ reason }),
    }
  )

  const data = await parseJson(response)

  if (!response.ok) {
    throw new SellerApplicationsError(data.message || "Could not reject application")
  }
}
