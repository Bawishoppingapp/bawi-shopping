"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import { approveTranslation, rejectTranslation } from "../services/translations-client"

export async function approveTranslationAction(translationId: string): Promise<void> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }
  await approveTranslation(sessionToken, translationId)
  revalidatePath("/translations")
}

export interface RejectTranslationState {
  status: "idle" | "error"
  formError?: string
}

export async function rejectTranslationAction(
  translationId: string,
  _prevState: RejectTranslationState,
  formData: FormData
): Promise<RejectTranslationState> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  const reason = String(formData.get("reason") ?? "").trim()
  if (!reason) {
    return { status: "error", formError: "Explain why this translation is being rejected" }
  }

  await rejectTranslation(sessionToken, translationId, reason)
  revalidatePath("/translations")
  return { status: "idle" }
}
