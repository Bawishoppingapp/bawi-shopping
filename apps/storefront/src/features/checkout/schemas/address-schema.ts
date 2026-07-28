import { z } from "zod"

/**
 * Client-side validation for immediate form feedback only - the backend's
 * own shippingAddressSchema (apps/backend/src/orders/schemas.ts) is the
 * actual authority and re-validates everything server-side.
 */
export const addressSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  address1: z.string().min(1, "Address is required"),
  address2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  province: z.string().min(1, "State / province is required"),
  postalCode: z.string().min(1, "ZIP / postal code is required"),
  countryCode: z.string().length(2, "Use a 2-letter country code"),
  phone: z.string().min(1, "Phone number is required"),
})

export type AddressFormValues = z.infer<typeof addressSchema>
