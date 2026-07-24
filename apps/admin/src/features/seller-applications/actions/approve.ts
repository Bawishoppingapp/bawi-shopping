"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ADMIN_SESSION_COOKIE } from "../../auth/constants"
import {
  approveSellerApplication,
  SellerApplicationsError,
} from "../services/seller-applications-client"
import type { ReviewActionState } from "../constants"

export async function approveApplication(
  applicationId: string,
  // Required by useActionState's (state, formData) call signature after
  // .bind(null, applicationId) - approve takes no form input of its own.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: ReviewActionState
): Promise<ReviewActionState> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value

  if (!sessionToken) {
    redirect("/login")
  }

  try {
    const result = await approveSellerApplication(sessionToken, applicationId)
    // Deliberately not revalidating this detail page: doing so would
    // re-render the parent Server Component with the new "approved" status,
    // which stops rendering <ReviewActions> at all - unmounting this exact
    // success message before the admin can read the activation link. The
    // list page still revalidates, so status is up to date everywhere else.
    revalidatePath("/applications")
    return { status: "success", activationLink: result.activation_link }
  } catch (error) {
    const message =
      error instanceof SellerApplicationsError
        ? error.message
        : "Something went wrong. Please try again."
    return { status: "error", formError: message }
  }
}
