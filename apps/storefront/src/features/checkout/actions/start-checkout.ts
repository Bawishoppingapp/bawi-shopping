"use server"

import { addressSchema } from "../schemas/address-schema"
import { startCheckout, CheckoutError } from "../services/checkout-client"
import { type CheckoutActionState } from "../constants"

/**
 * The idempotency key is generated once by the Server Component that
 * renders the checkout form (a hidden field, stable across re-submissions
 * of that same page load) - not here, so a double-click or network retry
 * of the same attempt reuses the same key rather than minting a new one
 * every action invocation (see docs/MARKETPLACE-FLOWS.md §1).
 */
export async function startCheckoutAction(
  _prevState: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const parsed = addressSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    address1: formData.get("address1"),
    address2: formData.get("address2") || undefined,
    city: formData.get("city"),
    province: formData.get("province"),
    postalCode: formData.get("postalCode"),
    countryCode: formData.get("countryCode"),
    phone: formData.get("phone"),
  })

  if (!parsed.success) {
    const fieldErrors: CheckoutActionState["fieldErrors"] = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof CheckoutActionState["fieldErrors"]
      if (!fieldErrors[field]) {
        fieldErrors[field] = issue.message
      }
    }
    return { status: "error", fieldErrors }
  }

  const idempotencyKey = formData.get("idempotencyKey")
  if (typeof idempotencyKey !== "string" || !idempotencyKey) {
    return {
      status: "error",
      fieldErrors: {},
      formError: "Could not start checkout. Please reload and try again.",
    }
  }

  try {
    const result = await startCheckout(
      {
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        address_1: parsed.data.address1,
        address_2: parsed.data.address2,
        city: parsed.data.city,
        province: parsed.data.province,
        postal_code: parsed.data.postalCode,
        country_code: parsed.data.countryCode,
        phone: parsed.data.phone,
      },
      idempotencyKey
    )
    return { status: "idle", fieldErrors: {}, result }
  } catch (error) {
    if (error instanceof CheckoutError) {
      return { status: "error", fieldErrors: {}, formError: error.message }
    }
    return {
      status: "error",
      fieldErrors: {},
      formError: "Could not start checkout. Please try again.",
    }
  }
}
