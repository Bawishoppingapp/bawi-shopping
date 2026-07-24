"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { loginSchema } from "../schemas/login-schema"
import { SELLER_SESSION_COOKIE, type LoginFormState } from "../constants"
import { loginSellerUser, MedusaAuthError } from "../services/medusa-auth-client"

export async function loginSeller(
  _prevState: LoginFormState,
  formData: FormData
): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    const fieldErrors: LoginFormState["fieldErrors"] = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof LoginFormState["fieldErrors"]
      if (!fieldErrors[field]) {
        fieldErrors[field] = issue.message
      }
    }
    return { status: "error", fieldErrors }
  }

  const { email, password } = parsed.data

  try {
    const sessionToken = await loginSellerUser(email, password)

    const cookieStore = await cookies()
    cookieStore.set(SELLER_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    })
  } catch (error) {
    // Generic message regardless of whether the email exists - never
    // confirm/deny account existence to an unauthenticated caller.
    const message =
      error instanceof MedusaAuthError
        ? "Invalid email or password"
        : "Something went wrong. Please try again."
    return { status: "error", fieldErrors: {}, formError: message }
  }

  redirect("/dashboard")
}
