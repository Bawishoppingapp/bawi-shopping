"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ADMIN_SESSION_COOKIE } from "../../auth/constants"
import { resendSellerActivationEmail, SellerApplicationsError } from "../services/seller-applications-client"

export type ResendActivationState = { status: "idle" | "success" | "error"; message?: string }

export async function resendActivationEmail(
  applicationId: string,
  // Required by useActionState; this action does not need prior form state.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _previous: ResendActivationState
): Promise<ResendActivationState> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if (!token) redirect("/login")
  try {
    const result = await resendSellerActivationEmail(token, applicationId)
    return { status: "success", message: `A new activation link was sent to ${result.email}.` }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof SellerApplicationsError ? error.message : "Could not send activation email. Please try again.",
    }
  }
}
