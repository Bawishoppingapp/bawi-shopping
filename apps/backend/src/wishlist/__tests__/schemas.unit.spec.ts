import { addWishlistItemSchema } from "../schemas"

describe("addWishlistItemSchema", () => {
  test("accepts a valid product_code", () => {
    const result = addWishlistItemSchema.safeParse({ product_code: "BAWI-TEE-001" })
    expect(result.success).toBe(true)
  })

  test("trims whitespace", () => {
    const result = addWishlistItemSchema.safeParse({ product_code: "  BAWI-TEE-001  " })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.product_code).toBe("BAWI-TEE-001")
    }
  })

  test("rejects an empty product_code", () => {
    const result = addWishlistItemSchema.safeParse({ product_code: "" })
    expect(result.success).toBe(false)
  })

  test("rejects a missing product_code", () => {
    const result = addWishlistItemSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})
