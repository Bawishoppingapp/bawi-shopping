import { z } from "zod"
import { isPostalCodeRequired } from "../../addresses/utils/postal-code-required"

/**
 * Client-side validation for immediate form feedback only - the backend's
 * own shippingAddressSchema (apps/backend/src/orders/schemas.ts) is the
 * actual authority and re-validates everything server-side. province/
 * postalCode aren't required by every country's addressing model (see
 * isPostalCodeRequired) - this used to unconditionally require both,
 * which would reject a real Ethiopian address.
 */
export const addressSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    address1: z.string().min(1, "Address is required"),
    address2: z.string().optional(),
    city: z.string().min(1, "City is required"),
    province: z.string().optional(),
    postalCode: z.string().optional(),
    countryCode: z.string().length(2, "Use a 2-letter country code"),
    phone: z.string().min(1, "Phone number is required"),
  })
  .superRefine((data, ctx) => {
    if (isPostalCodeRequired(data.countryCode) && !data.postalCode) {
      ctx.addIssue({ code: "custom", path: ["postalCode"], message: "ZIP / postal code is required for this country" })
    }
  })

export type AddressFormValues = z.infer<typeof addressSchema>
