import { describe, expect, test } from "vitest"
import { activationSchema } from "../schemas/activation-schema"

describe("activationSchema", () => {
  test("accepts matching, strong passwords", () => {
    const result = activationSchema.safeParse({
      token: "abc123",
      password: "Correct1horse",
      confirmPassword: "Correct1horse",
    })
    expect(result.success).toBe(true)
  })

  test("rejects mismatched passwords", () => {
    const result = activationSchema.safeParse({
      token: "abc123",
      password: "Correct1horse",
      confirmPassword: "Different1horse",
    })
    expect(result.success).toBe(false)
  })

  test("rejects a weak password", () => {
    const result = activationSchema.safeParse({
      token: "abc123",
      password: "weak",
      confirmPassword: "weak",
    })
    expect(result.success).toBe(false)
  })

  test("rejects a missing token", () => {
    const result = activationSchema.safeParse({
      token: "",
      password: "Correct1horse",
      confirmPassword: "Correct1horse",
    })
    expect(result.success).toBe(false)
  })
})
