import { describe, expect, test } from "vitest"
import { loginSchema } from "../schemas/login-schema"

describe("loginSchema", () => {
  test("accepts a valid email and password", () => {
    const result = loginSchema.safeParse({
      email: "admin@example.com",
      password: "anything",
    })
    expect(result.success).toBe(true)
  })

  test("rejects a malformed email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "anything",
    })
    expect(result.success).toBe(false)
  })

  test("rejects an empty password", () => {
    const result = loginSchema.safeParse({
      email: "admin@example.com",
      password: "",
    })
    expect(result.success).toBe(false)
  })
})
