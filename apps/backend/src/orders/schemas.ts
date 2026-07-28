import { z } from "@medusajs/framework/zod"

/**
 * Collected inline at checkout, not yet a reusable saved-address record -
 * see docs/DECISIONS.md (saved addresses are a later-batch customer-portal
 * feature). Snapshotted verbatim onto the order at checkout-start.
 */
export const shippingAddressSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  address_1: z.string().min(1),
  address_2: z.string().optional(),
  city: z.string().min(1),
  province: z.string().min(1),
  postal_code: z.string().min(1),
  country_code: z.string().length(2),
  phone: z.string().min(1),
})

export const startCheckoutSchema = z.object({
  shipping_address: shippingAddressSchema,
  idempotency_key: z.string().min(1),
})

export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>
export type StartCheckoutInput = z.infer<typeof startCheckoutSchema>
