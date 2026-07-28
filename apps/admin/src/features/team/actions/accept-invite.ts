"use server"

import { acceptAdminInvite, AcceptInviteError } from "../services/accept-invite-client"
import type { AcceptInviteFormState } from "../constants"

export async function acceptInviteAction(
  inviteToken: string,
  _prevState: AcceptInviteFormState,
  formData: FormData
): Promise<AcceptInviteFormState> {
  const email = String(formData.get("email") ?? "").trim()
  const firstName = String(formData.get("first_name") ?? "").trim()
  const lastName = String(formData.get("last_name") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!email || !firstName || !lastName || password.length < 8) {
    return {
      status: "error",
      formError: "Fill in every field with a password of at least 8 characters",
    }
  }

  try {
    await acceptAdminInvite({ inviteToken, email, password, firstName, lastName })
  } catch (error) {
    return {
      status: "error",
      formError: error instanceof AcceptInviteError ? error.message : "Could not accept this invite",
    }
  }

  return { status: "success" }
}
