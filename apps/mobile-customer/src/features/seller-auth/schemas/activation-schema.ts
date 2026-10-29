import { z } from "zod";

export const activationSchema = z.object({
  code: z.string().trim().min(1, "Enter the activation code from your email"),
});

export type ActivationInput = z.infer<typeof activationSchema>;
