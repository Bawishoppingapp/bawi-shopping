import { z } from "zod";

export const sellerLoginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SellerLoginInput = z.infer<typeof sellerLoginSchema>;
