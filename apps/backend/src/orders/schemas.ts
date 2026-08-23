import { z } from "@medusajs/framework/zod"
import { isPostalCodeRequired } from "./postal-code-required"

/**
 * Collected inline at checkout, not yet a reusable saved-address record -
 * see docs/DECISIONS.md (saved addresses are a later-batch customer-portal
 * feature). Snapshotted verbatim onto the order at checkout-start.
 *
 * province/postal_code aren't required by every country's addressing
 * model (see isPostalCodeRequired) - this used to unconditionally require
 * both, which would have rejected a valid Ethiopian address. sub_city/
 * woreda are optional, same "extra context in metadata-shaped fields" as
 * landmark/delivery_notes on the saved-address model.
 */
export const shippingAddressSchema = z
  .object({
    first_name: z.string().min(1),
    last_name: z.string().min(1),
    address_1: z.string().min(1),
    address_2: z.string().optional(),
    city: z.string().min(1),
    province: z.string().optional(),
    postal_code: z.string().optional(),
    country_code: z.string().length(2),
    phone: z.string().min(1),
    sub_city: z.string().optional(),
    woreda: z.string().optional(),
    landmark: z.string().optional(),
    delivery_notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (isPostalCodeRequired(data.country_code) && !data.postal_code) {
      ctx.addIssue({ code: "custom", path: ["postal_code"], message: "Postal code is required for this country" })
    }
  })

export const startCheckoutSchema = z.object({
  shipping_address: shippingAddressSchema,
  idempotency_key: z.string().min(1),
})

export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>
export type StartCheckoutInput = z.infer<typeof startCheckoutSchema>
