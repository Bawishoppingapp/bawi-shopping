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

export interface ProductTranslation {
  id: string
  locale: string
  title: string
  description: string | null
  status: string
  rejection_reason: string | null
}

export async function listTranslations(
  sessionToken: string,
  productListingId: string
): Promise<ProductTranslation[]> {
  const data = await request(`/seller/products/${productListingId}/translations`, sessionToken)
  return data.translations
}

export async function upsertTranslation(
  sessionToken: string,
  productListingId: string,
  input: { locale: string; title: string; description: string | null }
): Promise<void> {
  await request(`/seller/products/${productListingId}/translations`, sessionToken, {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export async function submitTranslation(
  sessionToken: string,
  productListingId: string,
  locale: string
): Promise<void> {
  await request(
    `/seller/products/${productListingId}/translations/${locale}/submit`,
    sessionToken,
    { method: "POST" }
  )
}
