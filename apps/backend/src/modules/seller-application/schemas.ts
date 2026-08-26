import { z } from "@medusajs/framework/zod"
import { isPostalCodeRequired } from "../../orders/postal-code-required"

// state/postal_code aren't required by every country's addressing model
// (see isPostalCodeRequired, same source of truth checkout's own address
// schema already uses) - this used to unconditionally require both,
// which would reject a real Ethiopian business address.
const addressSchema = z
  .object({
    line1: z.string().trim().min(1, "Address line 1 is required"),
    line2: z.string().trim().optional(),
    city: z.string().trim().min(1, "City is required"),
    state: z.string().trim().optional(),
    postal_code: z.string().trim().optional(),
    country: z.string().trim().min(2, "Country is required"),
  })
  .superRefine((data, ctx) => {
    if (isPostalCodeRequired(data.country) && !data.postal_code) {
      ctx.addIssue({ code: "custom", path: ["postal_code"], message: "Postal code is required for this country" })
    }
  })

export const BUSINESS_TYPES = [
  "sole_proprietorship",
  "llc",
  "corporation",
  "partnership",
  "other",
] as const

export const submitApplicationSchema = z.object({
  legal_business_name: z.string().trim().min(1, "Legal business name is required"),
  store_name: z.string().trim().min(1, "Store name is required"),
  business_type: z.enum(BUSINESS_TYPES),
  contact_first_name: z.string().trim().min(1, "First name is required"),
  contact_last_name: z.string().trim().min(1, "Last name is required"),
  business_email: z.string().trim().min(1, "Business email is required").email("Enter a valid email address"),
  phone_number: z.string().trim().min(7, "Enter a valid phone number"),
  website_url: z
    .union([z.string().trim().url("Enter a valid URL"), z.literal("")])
    .optional(),
  address: addressSchema,
  // Optional, defaulting "etb" now that Ethiopia is the platform's
  // primary market. Stays optional so any client that doesn't send this
  // field still works.
  currency_code: z.enum(["usd", "etb"]).optional().default("etb"),
  product_categories: z
    .array(z.string().trim().min(1))
    .min(1, "Select at least one product category"),
  business_description: z
    .string()
    .trim()
    .min(1, "Business description is required")
    .max(2000, "Keep the description under 2000 characters"),
  estimated_product_count: z.coerce
    .number()
    .int("Enter a whole number")
    .positive("Enter a number greater than zero"),
  agreed_to_terms: z.literal(true, {
    message: "You must agree to the seller terms",
  }),
})

export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>

export const rejectApplicationSchema = z.object({
  reason: z.string().trim().min(1, "A rejection reason is required").max(1000),
})

export const completeActivationSchema = z.object({
  token: z.string().trim().min(1),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[0-9]/, "Password must include a number"),
})
