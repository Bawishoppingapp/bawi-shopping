import { z } from "zod";

import { findCountry } from "../../addresses/data/countries";
import { isValidEthiopianPhone } from "../../addresses/utils/phone-format";

// Mirrors apps/seller-portal/src/features/seller-application/schemas/application-schema.ts
// exactly - same fields/constraints, checked client-side first for fast
// field-level errors, but apps/backend/src/modules/seller-application/schemas.ts's
// submitApplicationSchema re-validates regardless.
export const BUSINESS_TYPES = [
  { value: "sole_proprietorship", label: "Sole proprietorship" },
  { value: "llc", label: "LLC" },
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "other", label: "Other" },
] as const;

export const PRODUCT_CATEGORIES = [
  "Women's Apparel",
  "Men's Apparel",
  "Kids' Apparel",
  "Footwear",
  "Accessories",
  "Jewelry",
  "Bags",
  "Other",
] as const;

const businessTypeValues = BUSINESS_TYPES.map((t) => t.value) as [string, ...string[]];

export const applicationSchema = z
  .object({
    legal_business_name: z.string().trim().min(1, "Legal business name is required"),
    store_name: z.string().trim().min(1, "Store name is required"),
    business_type: z.enum(businessTypeValues, { message: "Select a business type" }),
    contact_first_name: z.string().trim().min(1, "First name is required"),
    contact_last_name: z.string().trim().min(1, "Last name is required"),
    business_email: z.string().trim().min(1, "Business email is required").email("Enter a valid email address"),
    phone_number: z.string().trim().min(7, "Enter a valid phone number"),
    website_url: z.union([z.string().trim().url("Enter a valid URL"), z.literal("")]).optional(),
    address_line1: z.string().trim().min(1, "Address is required"),
    address_line2: z.string().trim().optional(),
    address_city: z.string().trim().min(1, "City is required"),
    address_state: z.string().trim().optional(),
    address_postal_code: z.string().trim().optional(),
    address_country: z.string().trim().min(2, "Select a country"),
    currency_code: z.enum(["usd", "etb"], { message: "Select a currency" }),
    product_categories: z.array(z.string()).min(1, "Select at least one product category"),
    business_description: z
      .string()
      .trim()
      .min(1, "Business description is required")
      .max(2000, "Keep the description under 2000 characters"),
    estimated_product_count: z.coerce
      .number()
      .int("Enter a whole number")
      .positive("Enter a number greater than zero"),
    agreed_to_terms: z.literal(true, { message: "You must agree to the seller terms" }),
  })
  .superRefine((data, ctx) => {
    const country = findCountry(data.address_country);
    if (country?.postalCodeRequired && !data.address_postal_code) {
      ctx.addIssue({
        code: "custom",
        path: ["address_postal_code"],
        message: "Postal code is required for this country",
      });
    }
    if (
      data.address_country === "et" &&
      data.phone_number &&
      !isValidEthiopianPhone(data.phone_number)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["phone_number"],
        message: "Enter a valid Ethiopian mobile number (e.g. 0911234567)",
      });
    }
  });

export type ApplicationInput = z.infer<typeof applicationSchema>;
