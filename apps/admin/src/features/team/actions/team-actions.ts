"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { ADMIN_SESSION_COOKIE } from "@/features/auth/constants"
import {
  createAdminInvite,
  deleteAdminInvite,
  deleteAdminUser,
  TeamClientError,
} from "../services/team-client"

export interface CreateInviteState {
  status: "idle" | "error"
  formError?: string
}

export async function createInviteAction(
  _prevState: CreateInviteState,
  formData: FormData
): Promise<CreateInviteState> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  const email = String(formData.get("email") ?? "").trim()
  if (!email) {
    return { status: "error", formError: "Enter an email address" }
  }

  try {
    await createAdminInvite(sessionToken, email)
  } catch (error) {
    return {
      status: "error",
      formError: error instanceof TeamClientError ? error.message : "Could not create invite",
    }
  }

  revalidatePath("/team")
  return { status: "idle" }
}

export async function deleteInviteAction(inviteId: string): Promise<void> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }
  await deleteAdminInvite(sessionToken, inviteId)
  revalidatePath("/team")
}

export async function deleteUserAction(userId: string): Promise<void> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }
  await deleteAdminUser(sessionToken, userId)
  revalidatePath("/team")
}
