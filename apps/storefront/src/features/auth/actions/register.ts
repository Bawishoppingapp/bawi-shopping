"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { registerSchema } from "../schemas/register-schema"
import { CUSTOMER_SESSION_COOKIE, type RegisterFormState } from "../constants"
import {
  createCustomer,
  loginCustomer,
  registerCustomerAuthIdentity,
  MedusaAuthError,
} from "../services/medusa-auth-client"
import { mergeGuestCartOnLogin } from "@/features/cart/actions/merge-cart"

export async function registerCustomer(
  _prevState: RegisterFormState,
  formData: FormData
): Promise<RegisterFormState> {
  const parsed = registerSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    const fieldErrors: RegisterFormState["fieldErrors"] = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof RegisterFormState["fieldErrors"]
      if (!fieldErrors[field]) {
        fieldErrors[field] = issue.message
      }
    }
    return { status: "error", fieldErrors }
  }

  const { firstName, lastName, email, password } = parsed.data

  try {
    const registrationToken = await registerCustomerAuthIdentity(email, password)
    await createCustomer(registrationToken, {
      email,
      first_name: firstName,
      last_name: lastName,
    })
    const sessionToken = await loginCustomer(email, password)

    const cookieStore = await cookies()
    cookieStore.set(CUSTOMER_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    })

    // Best-effort: a customer who just created an account should never be
    // blocked from finishing registration because of a guest-cart merge
    // hiccup - the guest cart cookie simply stays around to retry later.
    try {
      await mergeGuestCartOnLogin(sessionToken)
    } catch {
      // Intentionally swallowed - see comment above.
    }
  } catch (error) {
    if (error instanceof MedusaAuthError) {
      const isDuplicate = /already exists/i.test(error.message)
      return {
        status: "error",
        fieldErrors: {},
        formError: isDuplicate
          ? "An account with this email already exists."
          : error.message,
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
