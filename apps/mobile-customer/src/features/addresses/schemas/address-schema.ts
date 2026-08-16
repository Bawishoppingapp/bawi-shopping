import { z } from "zod";

// Same required/optional fields as apps/storefront/src/features/addresses/actions/addresses-actions.ts's
// ad-hoc FormData validation, expressed as Zod - this app validates every
// form with Zod (register.tsx, sell/apply.tsx, product schemas, etc.), so
// this brings addresses in line rather than porting the web's ad-hoc
// approach.
export const addressSchema = z.object({
  address_name: z.string().trim().optional(),
  first_name: z.string().trim().min(1, "First name is required"),
  last_name: z.string().trim().min(1, "Last name is required"),
  company: z.string().trim().optional(),
  address_1: z.string().trim().min(1, "Address is required"),
  address_2: z.string().trim().optional(),
  city: z.string().trim().min(1, "City is required"),
  province: z.string().trim().optional(),
  postal_code: z.string().trim().min(1, "Postal code is required"),
  country_code: z.string().trim().min(2, "Country is required"),
  phone: z.string().trim().optional(),
  is_default_shipping: z.boolean(),
});

export type AddressFormInput = z.infer<typeof addressSchema>;
