import "server-only"

const MEDUSA_BACKEND_URL = process.env.MEDUSA_BACKEND_URL ?? "http://localhost:9000"

export class BusinessConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BusinessConfigError"
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

export interface ConfigEntry {
  category: string
  key: string
  value: unknown
  value_type: "integer" | "boolean" | "string" | "json"
  label: string
  description: string | null
  is_placeholder: boolean
  is_sensitive: boolean
  updated_by: string | null
  updated_at: string | null
}

export async function listConfigEntries(sessionToken: string): Promise<ConfigEntry[]> {
  const response = await fetch(`${MEDUSA_BACKEND_URL}/admin/business-config`, {
    headers: { Authorization: `Bearer ${sessionToken}` },
    cache: "no-store",
  })
  if (!response.ok) {
    throw new BusinessConfigError("Could not load business configuration")
  }
  const data = await parseJson(response)
  return data.entries as ConfigEntry[]
}

export async function updateConfigEntry(
  sessionToken: string,
  category: string,
  key: string,
  value: unknown
): Promise<void> {
  const response = await fetch(
    `${MEDUSA_BACKEND_URL}/admin/business-config/${category}/${key}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value }),
    }
  )
  if (!response.ok) {
    const data = await parseJson(response)
    throw new BusinessConfigError(data.message || "Could not update value")
  }
}
