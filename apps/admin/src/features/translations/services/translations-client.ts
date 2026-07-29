import "server-only"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export class TranslationsClientError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TranslationsClientError"
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

async function request(path: string, sessionToken: string, init?: RequestInit) {
  const response = await fetch(`${MEDUSA_BACKEND_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  })
  const data = await parseJson(response)
  if (!response.ok) {
    throw new TranslationsClientError(data.message || "Request failed")
  }
  return data
}

export interface PendingTranslation {
  id: string
  product_id: string
  vendor_id: string
  locale: string
  title: string
  description: string | null
  status: string
  submitted_at: string | null
}

export async function listPendingTranslations(sessionToken: string): Promise<PendingTranslation[]> {
  const data = await request("/admin/product-translations?status=pending_review", sessionToken)
  return data.translations
}

export async function approveTranslation(sessionToken: string, id: string): Promise<void> {
  await request(`/admin/product-translations/${id}/approve`, sessionToken, { method: "POST" })
}

export async function rejectTranslation(
  sessionToken: string,
  id: string,
  reason: string
): Promise<void> {
  await request(`/admin/product-translations/${id}/reject`, sessionToken, {
    method: "POST",
    body: JSON.stringify({ reason }),
  })
}
