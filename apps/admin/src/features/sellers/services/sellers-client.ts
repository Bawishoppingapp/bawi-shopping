import "server-only"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export interface SellerSummary {
  id: string
  name: string
  slug: string
  status: string
  public_brand_display_approved: boolean
  created_at: string
}

export async function listSellers(sessionToken: string): Promise<SellerSummary[]> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/admin/sellers`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
    cache: "no-store",
  })
  if (!response.ok) {
    return []
  }
  const data = await response.json()
  return data.sellers as SellerSummary[]
}
