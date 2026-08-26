"use server"

import { revalidatePath } from "next/cache"
import { createAddress, deleteAddress, AddressesClientError } from "../services/addresses-client"
import { isPostalCodeRequired } from "../utils/postal-code-required"

export interface AddressFormState {
  status: "idle" | "error"
  formError?: string
}

export async function createAddressAction(
  _prevState: AddressFormState,
  formData: FormData
): Promise<AddressFormState> {
  const firstName = String(formData.get("first_name") ?? "").trim()
  const lastName = String(formData.get("last_name") ?? "").trim()
  const address1 = String(formData.get("address_1") ?? "").trim()
  const city = String(formData.get("city") ?? "").trim()
  const postalCode = String(formData.get("postal_code") ?? "").trim()
  const countryCode = String(formData.get("country_code") ?? "").trim()

  if (!firstName || !lastName || !address1 || !city || !countryCode) {
    return { status: "error", formError: "Please fill in all required fields" }
  }
  if (!postalCode && isPostalCodeRequired(countryCode.toLowerCase())) {
    return { status: "error", formError: "Postal code is required for this country" }
  }

  try {
    await createAddress({
      first_name: firstName,
      last_name: lastName,
      address_1: address1,
      address_2: String(formData.get("address_2") ?? "").trim() || undefined,
      city,
      province: String(formData.get("province") ?? "").trim() || undefined,
      postal_code: postalCode || undefined,
      country_code: countryCode.toLowerCase(),
      phone: String(formData.get("phone") ?? "").trim() || undefined,
      is_default_shipping: formData.get("is_default_shipping") === "on",
    })
  } catch (error) {
    return {
      status: "error",
      formError: error instanceof AddressesClientError ? error.message : "Could not save this address",
    }
  }

  revalidatePath("/account")
  return { status: "idle" }
}

export async function deleteAddressAction(addressId: string): Promise<void> {
  await deleteAddress(addressId)
  revalidatePath("/account")
}
