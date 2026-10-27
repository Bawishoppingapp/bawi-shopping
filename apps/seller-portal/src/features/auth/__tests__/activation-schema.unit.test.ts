import { describe, expect, test } from "vitest"
import { activationSchema } from "../schemas/activation-schema"

describe("activationSchema", () => {
  test("accepts matching, strong passwords", () => {
    const result = activationSchema.safeParse({
      token: "abc123",
      existingAccount: false,
      password: "Correct1horse",
      confirmPassword: "Correct1horse",
    })
    expect(result.success).toBe(true)
  })

  test("rejects mismatched passwords", () => {
    const result = activationSchema.safeParse({
      token: "abc123",
      existingAccount: false,
      password: "Correct1horse",
      confirmPassword: "Different1horse",
    })
    expect(result.success).toBe(false)
  })

  test("rejects a weak password", () => {
    const result = activationSchema.safeParse({
      token: "abc123",
      existingAccount: false,
      password: "weak",
      confirmPassword: "weak",
    })
    expect(result.success).toBe(false)
  })

  test("rejects a missing token", () => {
    const result = activationSchema.safeParse({
      token: "",
      existingAccount: false,
      password: "Correct1horse",
      confirmPassword: "Correct1horse",
    })
    expect(result.success).toBe(false)
  })

  test("accepts an existing Bawi password without asking for a new one", () => {
    const result = activationSchema.safeParse({
      token: "abc123",
      existingAccount: true,
      password: "existing-password",
    })
    expect(result.success).toBe(true)
  })
})
