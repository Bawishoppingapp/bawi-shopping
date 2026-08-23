import { z } from "zod";

import { findCountry } from "../data/countries";
import { isValidEthiopianPhone } from "../utils/phone-format";

// International address model: postal code isn't required by every
// country (superRefine below checks the selected country's own
// requirement instead of a blanket rule), province/landmark/delivery
// notes are optional everywhere since not every country's addressing
// relies on them the same way. See addresses-client.ts's AddressMetadata
// doc comment for why landmark/delivery_notes live in metadata, not as
// dedicated fields.
export const addressSchema = z
  .object({
    address_name: z.string().trim().optional(),
    first_name: z.string().trim().min(1, "First name is required"),
    last_name: z.string().trim().min(1, "Last name is required"),
    company: z.string().trim().optional(),
    address_1: z.string().trim().min(1, "Address is required"),
    address_2: z.string().trim().optional(),
    city: z.string().trim().min(1, "City is required"),
    province: z.string().trim().optional(),
    postal_code: z.string().trim().optional(),
    country_code: z.string().trim().min(2, "Select a country"),
    phone: z.string().trim().optional(),
    sub_city: z.string().trim().optional(),
    woreda: z.string().trim().optional(),
    landmark: z.string().trim().optional(),
    delivery_notes: z.string().trim().optional(),
    is_default_shipping: z.boolean(),
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
    // Only Ethiopian numbers get real format validation - every other
    // country's phone field stays free-text (see phone-format.ts).
    if (data.country_code === "et" && data.phone && !isValidEthiopianPhone(data.phone)) {
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Enter a valid Ethiopian mobile number (e.g. 0911234567)",
      });
    }
  });

export type AddressFormInput = z.infer<typeof addressSchema>;
