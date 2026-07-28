"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { SELLER_SESSION_COOKIE } from "@/features/auth/constants"
import { approveReturnRequest, denyReturnRequest } from "../services/finance-client"

export interface ReturnActionState {
  status: "idle" | "error"
  formError?: string
}

export async function approveReturnRequestAction(
  returnRequestId: string,
  _prevState: ReturnActionState,
  formData: FormData
): Promise<ReturnActionState> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  const requestedAmountRaw = formData.get("requested_amount")
  const requestedAmount =
    typeof requestedAmountRaw === "string" && requestedAmountRaw.trim() !== ""
      ? Math.round(Number(requestedAmountRaw) * 100)
      : undefined

  try {
    await approveReturnRequest(sessionToken, returnRequestId, requestedAmount)
  } catch (error) {
    return {
      status: "error",
      formError: error instanceof Error ? error.message : "Could not approve this return",
    }
  }

  revalidatePath(`/returns/${returnRequestId}`)
  revalidatePath("/returns")
  revalidatePath("/finance")
  return { status: "idle" }
}

export async function denyReturnRequestAction(
  returnRequestId: string,
  _prevState: ReturnActionState,
  formData: FormData
): Promise<ReturnActionState> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  const sellerResponse = String(formData.get("seller_response") ?? "").trim()
  if (!sellerResponse) {
    return { status: "error", formError: "Explain why this return is being denied" }
  }

  try {
    await denyReturnRequest(sessionToken, returnRequestId, sellerResponse)
  } catch (error) {
    return {
      status: "error",
      formError: error instanceof Error ? error.message : "Could not deny this return",
    }
  }

  revalidatePath(`/returns/${returnRequestId}`)
  revalidatePath("/returns")
  return { status: "idle" }
}
