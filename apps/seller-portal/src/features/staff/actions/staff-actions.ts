"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import { inviteStaff, removeStaff, StaffClientError } from "../services/staff-client"

export interface InviteStaffState {
  status: "idle" | "error"
  formError?: string
}

export async function inviteStaffAction(
  _prevState: InviteStaffState,
  formData: FormData
): Promise<InviteStaffState> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  const email = String(formData.get("email") ?? "").trim()
  const role = String(formData.get("role") ?? "")
  if (!email || !["catalog_manager", "order_fulfiller", "analyst"].includes(role)) {
    return { status: "error", formError: "Enter a valid email and choose a role" }
  }

  try {
    await inviteStaff(sessionToken, email, role)
  } catch (error) {
    return {
      status: "error",
      formError: error instanceof StaffClientError ? error.message : "Could not invite this person",
    }
  }

  revalidatePath("/staff")
  return { status: "idle" }
}

export async function removeStaffAction(staffId: string): Promise<void> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }
  await removeStaff(sessionToken, staffId)
  revalidatePath("/staff")
}
