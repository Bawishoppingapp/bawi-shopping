"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { ADMIN_SESSION_COOKIE } from "../../auth/constants"
import { createCourier, CouriersClientError } from "../services/couriers-client"
import type { CreateCourierFormState } from "../constants"

const createCourierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().optional(),
})

export async function createCourierAction(
  _prevState: CreateCourierFormState,
  formData: FormData
): Promise<CreateCourierFormState> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  const parsed = createCourierSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
  })
  if (!parsed.success) {
    const fieldErrors: CreateCourierFormState["fieldErrors"] = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof CreateCourierFormState["fieldErrors"]
      if (!fieldErrors[field]) {
        fieldErrors[field] = issue.message
      }
    }
    return { status: "error", fieldErrors }
  }

  try {
    const result = await createCourier(sessionToken, parsed.data)
    revalidatePath("/couriers")
    return { status: "success", fieldErrors: {}, activationUrl: result.activation_url }
  } catch (error) {
    const message =
      error instanceof CouriersClientError ? error.message : "Something went wrong. Please try again."
    return { status: "error", fieldErrors: {}, formError: message }
  }
}
