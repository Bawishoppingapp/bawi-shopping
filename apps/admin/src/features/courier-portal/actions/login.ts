"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { loginSchema } from "../schemas/auth-schemas"
import { COURIER_SESSION_COOKIE, type LoginFormState } from "../constants"
import { loginCourier, CourierAuthError } from "../services/courier-auth-client"

export async function loginCourierAction(
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

  try {
    const sessionToken = await loginCourier(parsed.data.email, parsed.data.password)
    const cookieStore = await cookies()
    cookieStore.set(COURIER_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    })
  } catch (error) {
    const message =
      error instanceof CourierAuthError ? "Invalid email or password" : "Something went wrong."
    return { status: "error", fieldErrors: {}, formError: message }
  }

  redirect("/courier/dashboard")
}
