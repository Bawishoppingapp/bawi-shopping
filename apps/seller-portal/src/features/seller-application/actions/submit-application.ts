"use server"

import { redirect } from "next/navigation"
import { applicationSchema } from "../schemas/application-schema"
import type { ApplicationFormState } from "../constants"
import {
  submitSellerApplication,
  SellerApplicationError,
} from "../services/seller-application-client"

export async function submitApplication(
  _prevState: ApplicationFormState,
  formData: FormData
): Promise<ApplicationFormState> {
  const parsed = applicationSchema.safeParse({
    legal_business_name: formData.get("legal_business_name"),
    store_name: formData.get("store_name"),
    business_type: formData.get("business_type"),
    contact_first_name: formData.get("contact_first_name"),
    contact_last_name: formData.get("contact_last_name"),
    business_email: formData.get("business_email"),
    phone_number: formData.get("phone_number"),
    website_url: formData.get("website_url") || undefined,
    address_line1: formData.get("address_line1"),
    address_line2: formData.get("address_line2") || undefined,
    address_city: formData.get("address_city"),
    address_state: formData.get("address_state"),
    address_postal_code: formData.get("address_postal_code"),
    currency_code: formData.get("currency_code"),
    product_categories: formData.getAll("product_categories"),
    business_description: formData.get("business_description"),
    estimated_product_count: formData.get("estimated_product_count"),
    agreed_to_terms: formData.get("agreed_to_terms") === "on",
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0])
      if (!fieldErrors[field]) {
        fieldErrors[field] = issue.message
      }
    }
    return { status: "error", fieldErrors }
  }

  let applicationId: string

  try {
    const application = await submitSellerApplication(parsed.data)
    applicationId = application.id
  } catch (error) {
    if (error instanceof SellerApplicationError) {
      return { status: "error", fieldErrors: {}, formError: error.message }
    }
    return {
      status: "error",
      fieldErrors: {},
      formError: "Something went wrong. Please try again.",
    }
  }

  redirect(`/apply/${applicationId}`)
}
