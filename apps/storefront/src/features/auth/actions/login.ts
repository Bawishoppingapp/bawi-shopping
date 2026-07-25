"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { loginSchema } from "../schemas/login-schema"
import { CUSTOMER_SESSION_COOKIE, type LoginFormState } from "../constants"
import { loginCustomer, MedusaAuthError } from "../services/medusa-auth-client"
import { mergeGuestCartOnLogin } from "@/features/cart/actions/merge-cart"

export async function loginCustomerAction(
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
    const sessionToken = await loginCustomer(email, password)

    const cookieStore = await cookies()
    cookieStore.set(CUSTOMER_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    })

    // Best-effort, same reasoning as register.ts - a merge hiccup must
    // never block a returning customer from logging in.
    try {
      await mergeGuestCartOnLogin(sessionToken)
    } catch {
      // Intentionally swallowed.
    }
  } catch (error) {
    if (error instanceof MedusaAuthError) {
      return {
        status: "error",
        fieldErrors: {},
        // Deliberately generic - never confirm/deny whether an email is
        // registered (see docs/SECURITY.md).
        formError: "Invalid email or password.",
      }
    }
    return {
      status: "error",
      fieldErrors: {},
      formError: "Something went wrong. Please try again.",
    }
  }

  redirect("/account")
}
