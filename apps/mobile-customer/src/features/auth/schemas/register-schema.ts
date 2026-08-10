import { z } from "zod";

// Same rules as apps/storefront/src/features/auth/schemas/register-schema.ts
// - kept in sync by hand, matching this project's existing convention of
// colocating near-identical schemas per app rather than sharing a
// package for something this small (see storefront/seller-portal's own
// login-schema.ts, which are byte-identical and still not shared).
export const registerSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must include a lowercase letter")
    .regex(/[A-Z]/, "Password must include an uppercase letter")
    .regex(/[0-9]/, "Password must include a number"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
