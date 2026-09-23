import { z } from "zod";

import { PASSWORD_RULES } from "./register-schema";

const passwordSchema = z.string().superRefine((password, ctx) => {
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(password)) {
      ctx.addIssue({ code: "custom", message: `Password must include: ${rule.label.toLowerCase()}` });
    }
  }
});

export const resetPasswordSchema = z
  .object({
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
    token: z.string().trim().min(1, "Reset code is required"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
