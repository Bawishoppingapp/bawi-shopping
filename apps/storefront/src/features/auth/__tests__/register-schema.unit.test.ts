import { describe, expect, test } from "vitest"
import { registerSchema } from "../schemas/register-schema"

const validInput = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  password: "Correct1horse",
}

describe("registerSchema", () => {
  test("accepts valid input", () => {
    const result = registerSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  test("rejects a malformed email", () => {
    const result = registerSchema.safeParse({ ...validInput, email: "not-an-email" })
    expect(result.success).toBe(false)
  })

  test("rejects a missing first name", () => {
    const result = registerSchema.safeParse({ ...validInput, firstName: "" })
    expect(result.success).toBe(false)
  })

  test.each([
    ["short", "Ab1"],
    ["no uppercase", "correct1horse"],
    ["no lowercase", "CORRECT1HORSE"],
    ["no number", "CorrectHorse"],
  ])("rejects a password that is %s", (_label, password) => {
    const result = registerSchema.safeParse({ ...validInput, password })
    expect(result.success).toBe(false)
  })

  test("trims whitespace from names before validating", () => {
    const result = registerSchema.safeParse({
      ...validInput,
      firstName: "  Jane  ",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.firstName).toBe("Jane")
    }
  })
})
