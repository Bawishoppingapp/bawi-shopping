import { z } from "zod"

export const activationSchema = z
  .object({
    token: z.string().trim().min(1),
    existingAccount: z.boolean(),
    password: z
      .string()
      .min(1, "Enter your password"),
    confirmPassword: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.existingAccount) return
    if (data.password.length < 8 || !/[a-z]/.test(data.password) || !/[A-Z]/.test(data.password) || !/[0-9]/.test(data.password)) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "Use at least 8 characters with uppercase, lowercase and a number" })
    }
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" })
    }
  })

export type ActivationInput = z.infer<typeof activationSchema>
