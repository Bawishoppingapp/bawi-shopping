"use server"

import { activationSchema } from "../schemas/activation-schema"
import type { ActivationFormState } from "../constants"
import { completeSellerActivation, MedusaAuthError } from "../services/medusa-auth-client"

export async function activateSellerAccount(
  _prevState: ActivationFormState,
  formData: FormData
): Promise<ActivationFormState> {
  const parsed = activationSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  })

  if (!parsed.success) {
    const fieldErrors: ActivationFormState["fieldErrors"] = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof ActivationFormState["fieldErrors"]
      if (!fieldErrors[field]) {
        fieldErrors[field] = issue.message
      }
    }
    return { status: "error", fieldErrors }
  }

  try {
    await completeSellerActivation(parsed.data.token, parsed.data.password)
  } catch (error) {
    const message =
      error instanceof MedusaAuthError
        ? error.message
        : "Something went wrong. Please try again."
    return { status: "error", fieldErrors: {}, formError: message }
  }

  return { status: "success", fieldErrors: {} }
}
