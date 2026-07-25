"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SELLER_SESSION_COOKIE } from "../../auth/constants"
import { createOnboardingLink, StripeOnboardingError } from "../services/stripe-client"
import type { StripeOnboardingState } from "../constants"

// `redirect()` signals success by throwing an internal error tagged with a
// "NEXT_REDIRECT" digest - there is no stable exported type-guard for this
// in the installed Next version (see apps/seller-portal/AGENTS.md), so it's
// detected the same way Next's own source does internally.
function isNextRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  )
}

export async function startStripeOnboardingAction(
  // Required by useActionState's (state, formData) call signature - this
  // action takes no form input of its own, same pattern as
  // apps/admin/src/features/product-listings/actions/approve.ts.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: StripeOnboardingState
): Promise<StripeOnboardingState> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SELLER_SESSION_COOKIE)?.value
  if (!sessionToken) {
    redirect("/login")
  }

  try {
    const url = await createOnboardingLink(sessionToken)
    redirect(url)
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error
    }
    const message =
      error instanceof StripeOnboardingError ? error.message : "Something went wrong. Please try again."
    return { status: "error", formError: message }
  }
}
