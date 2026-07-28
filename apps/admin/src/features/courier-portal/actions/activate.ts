"use server"

import { activationSchema } from "../schemas/auth-schemas"
import { type ActivationFormState } from "../constants"
import { completeCourierActivation, CourierAuthError } from "../services/courier-auth-client"

export async function activateCourierAction(
  _prevState: ActivationFormState,
  formData: FormData
): Promise<ActivationFormState> {
  const parsed = activationSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { status: "error", formError: parsed.error.issues[0]?.message }
  }

  try {
    await completeCourierActivation(parsed.data.token, parsed.data.password)
  } catch (error) {
    const message = error instanceof CourierAuthError ? error.message : "Something went wrong."
    return { status: "error", formError: message }
  }

  return { status: "success" }
}
