import { z } from "zod";

// Same rules as apps/storefront/src/features/auth/schemas/register-schema.ts
// - kept in sync by hand, matching this project's existing convention of
// colocating near-identical schemas per app rather than sharing a
// package for something this small (see storefront/seller-portal's own
// login-schema.ts, which are byte-identical and still not shared).
//
// PASSWORD_RULES is the single source of truth for both the Zod schema
// below and the live checklist UI (password-requirements.tsx) - the
// checklist must never show a rule the backend doesn't actually enforce,
// so both read from the same array instead of duplicating regexes.
export const PASSWORD_RULES: { key: string; label: string; test: (password: string) => boolean }[] = [
  { key: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { key: "lowercase", label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { key: "uppercase", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { key: "number", label: "One number", test: (p) => /[0-9]/.test(p) },
];

const passwordSchema = z.string().superRefine((password, ctx) => {
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(password)) {
      ctx.addIssue({ code: "custom", message: `Password must include: ${rule.label.toLowerCase()}` });
    }
  }
});

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
