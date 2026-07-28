"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { ADMIN_SESSION_COOKIE } from "../../auth/constants"
import { assignCourier, FulfillmentClientError } from "../services/fulfillment-client"

export interface AssignCourierFormState {
  status: "idle" | "error"
  formError?: string
}

export const initialAssignCourierFormState: AssignCourierFormState = { status: "idle" }

export async function assignCourierAction(
  fulfillmentOrderId: string,
  _prevState: AssignCourierFormState,
  formData: FormData
): Promise<AssignCourierFormState> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  const courierId = formData.get("courier_id")
  if (typeof courierId !== "string" || !courierId) {
    return { status: "error", formError: "Select a courier" }
  }

  try {
    await assignCourier(sessionToken, fulfillmentOrderId, courierId)
  } catch (error) {
    const message =
      error instanceof FulfillmentClientError
        ? error.message
        : "Something went wrong. Please try again."
    return { status: "error", formError: message }
  }

  revalidatePath("/fulfillment")
  return { status: "idle" }
}
