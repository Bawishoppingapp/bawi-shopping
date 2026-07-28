"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { COURIER_SESSION_COOKIE, type CodeFormState } from "../constants"
import {
  confirmPickup,
  startDelivery,
  confirmDelivery,
  AssignmentsClientError,
} from "../services/assignments-client"

async function requireSessionToken(): Promise<string> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(COURIER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/courier/login")
  }
  return sessionToken
}

export async function confirmPickupAction(
  assignmentId: string,
  _prevState: CodeFormState,
  formData: FormData
): Promise<CodeFormState> {
  const sessionToken = await requireSessionToken()
  const code = formData.get("code")
  if (typeof code !== "string" || !code) {
    return { status: "error", formError: "Enter the pickup code" }
  }

  try {
    await confirmPickup(sessionToken, assignmentId, code)
  } catch (error) {
    const message =
      error instanceof AssignmentsClientError ? error.message : "Something went wrong."
    return { status: "error", formError: message }
  }

  revalidatePath(`/courier/assignments/${assignmentId}`)
  revalidatePath("/courier/dashboard")
  return { status: "idle" }
}

export async function startDeliveryAction(assignmentId: string): Promise<void> {
  const sessionToken = await requireSessionToken()
  await startDelivery(sessionToken, assignmentId)
  revalidatePath(`/courier/assignments/${assignmentId}`)
  revalidatePath("/courier/dashboard")
}

export async function confirmDeliveryAction(
  assignmentId: string,
  _prevState: CodeFormState,
  formData: FormData
): Promise<CodeFormState> {
  const sessionToken = await requireSessionToken()
  const code = formData.get("code")
  if (typeof code !== "string" || !code) {
    return { status: "error", formError: "Enter the delivery code" }
  }

  try {
    await confirmDelivery(sessionToken, assignmentId, code)
  } catch (error) {
    const message =
      error instanceof AssignmentsClientError ? error.message : "Something went wrong."
    return { status: "error", formError: message }
  }

  revalidatePath(`/courier/assignments/${assignmentId}`)
  revalidatePath("/courier/dashboard")
  return { status: "idle" }
}
