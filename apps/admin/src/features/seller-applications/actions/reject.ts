"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { ADMIN_SESSION_COOKIE } from "../../auth/constants"
import {
  rejectSellerApplication,
  SellerApplicationsError,
} from "../services/seller-applications-client"
import type { ReviewActionState } from "../constants"

const reasonSchema = z.object({
  reason: z.string().trim().min(1, "A rejection reason is required"),
})

export async function rejectApplication(
  applicationId: string,
  _prevState: ReviewActionState,
  formData: FormData
): Promise<ReviewActionState> {
  const parsed = reasonSchema.safeParse({ reason: formData.get("reason") })
  if (!parsed.success) {
    return {
      status: "error",
      formError: parsed.error.issues[0]?.message ?? "Invalid input",
    }
  }

  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  if (!sessionToken) {
    redirect("/login")
  }

  try {
    await rejectSellerApplication(sessionToken, applicationId, parsed.data.reason)
    // See approve.ts - not revalidating this detail page so the success
    // confirmation isn't unmounted the instant the status changes server-side.
    revalidatePath("/applications")
    return { status: "success" }
  } catch (error) {
    const message =
      error instanceof SellerApplicationsError
        ? error.message
        : "Something went wrong. Please try again."
    return { status: "error", formError: message }
  }
}
