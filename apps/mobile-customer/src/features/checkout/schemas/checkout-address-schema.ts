import { z } from "zod";

import { findCountry } from "../../addresses/data/countries";
import { isValidEthiopianPhone } from "../../addresses/utils/phone-format";

// Client-side validation for immediate field feedback only - the
// backend's own shippingAddressSchema (apps/backend/src/orders/schemas.ts)
// is the actual authority and re-validates everything server-side.
// province/postal_code aren't required by every country's addressing
// model (see isPostalCodeRequired's country data, reused here via
// findCountry) - same conditional pattern already used by this app's
// saved-address form and seller-application form.
export const checkoutAddressSchema = z
  .object({
    first_name: z.string().trim().min(1, "First name is required"),
    last_name: z.string().trim().min(1, "Last name is required"),
    address_1: z.string().trim().min(1, "Address is required"),
    address_2: z.string().trim().optional(),
    city: z.string().trim().min(1, "City is required"),
    province: z.string().trim().optional(),
    postal_code: z.string().trim().optional(),
    country_code: z.string().trim().min(2, "Select a country"),
    phone: z.string().trim().min(1, "Phone number is required"),
    sub_city: z.string().trim().optional(),
    woreda: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    const country = findCountry(data.country_code);
    if (country?.postalCodeRequired && !data.postal_code) {
      ctx.addIssue({
        code: "custom",
        path: ["postal_code"],
        message: "Postal code is required for this country",
      });
    }
    if (data.country_code === "et" && !isValidEthiopianPhone(data.phone)) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Enter a valid Ethiopian mobile number (e.g. 0911234567)",
      });
    }
  });

export type CheckoutAddressInput = z.infer<typeof checkoutAddressSchema>;
