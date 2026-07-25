"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ADMIN_SESSION_COOKIE } from "../../auth/constants"
import { updateConfigEntry, BusinessConfigError } from "../services/business-config-client"
import type { ConfigEntryFormState } from "../constants"

function coerceValue(valueType: string, raw: FormDataEntryValue | null): unknown {
  if (valueType === "boolean") {
    return raw === "on"
  }
  if (valueType === "integer") {
    const parsed = Number.parseInt(String(raw ?? ""), 10)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (valueType === "json") {
    try {
      return JSON.parse(String(raw ?? "null"))
    } catch {
      return null
    }
  }
  return String(raw ?? "")
}

export async function updateConfigEntryAction(
  category: string,
  key: string,
  valueType: string,
  _prevState: ConfigEntryFormState,
  formData: FormData
): Promise<ConfigEntryFormState> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  const value = coerceValue(valueType, formData.get("value"))

  if (valueType === "json" && value === null && String(formData.get("value") ?? "").trim()) {
    return { status: "error", formError: "Invalid JSON" }
  }

  try {
    await updateConfigEntry(sessionToken, category, key, value)
  } catch (error) {
    const message =
      error instanceof BusinessConfigError ? error.message : "Something went wrong. Please try again."
    return { status: "error", formError: message }
  }

  revalidatePath("/config")
  return { status: "success" }
}
