"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { loginSchema } from "../schemas/login-schema"
import { ADMIN_SESSION_COOKIE, type LoginFormState } from "../constants"
import { loginAdminUser, MedusaAuthError } from "../services/medusa-auth-client"

export async function loginAdmin(
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
    const sessionToken = await loginAdminUser(email, password)

    const cookieStore = await cookies()
    cookieStore.set(ADMIN_SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    })
  } catch (error) {
    const message =
      error instanceof MedusaAuthError
        ? "Invalid email or password"
        : "Something went wrong. Please try again."
    return { status: "error", fieldErrors: {}, formError: message }
  }

  redirect("/applications")
}
