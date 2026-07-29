"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import {
  upsertTranslation,
  submitTranslation,
  TranslationsClientError,
} from "../services/translations-client"

export interface TranslationFormState {
  status: "idle" | "error"
  formError?: string
}

export async function saveTranslationAction(
  productListingId: string,
  _prevState: TranslationFormState,
  formData: FormData
): Promise<TranslationFormState> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  const locale = String(formData.get("locale") ?? "")
  const title = String(formData.get("title") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()

  if (!locale || !title) {
    return { status: "error", formError: "A title is required" }
  }

  try {
    await upsertTranslation(sessionToken, productListingId, {
      locale,
      title,
      description: description || null,
    })
  } catch (error) {
    return {
      status: "error",
      formError:
        error instanceof TranslationsClientError ? error.message : "Could not save this translation",
    }
  }

  revalidatePath(`/products/${productListingId}/translations`)
  return { status: "idle" }
}

export async function submitTranslationAction(
  productListingId: string,
  locale: string
): Promise<void> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }
  await submitTranslation(sessionToken, productListingId, locale)
  revalidatePath(`/products/${productListingId}/translations`)
}
