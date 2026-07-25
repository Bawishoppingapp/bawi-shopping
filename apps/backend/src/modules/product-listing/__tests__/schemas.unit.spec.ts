import {
  productDraftSchema,
  addProductImageSchema,
  rejectProductListingSchema,
} from "../schemas"

function validDraft(overrides: Record<string, unknown> = {}) {
  return {
    title: "Denim Jacket",
    description: "A sturdy denim jacket.",
    category_id: "pcat_123",
    base_price: 4999,
    variants: [{ color: "Blue", size: "M", inventory_quantity: 10 }],
    ...overrides,
  }
}

describe("productDraftSchema", () => {
  test("accepts a valid draft", () => {
    expect(productDraftSchema.safeParse(validDraft()).success).toBe(true)
  })

  test("rejects a missing title", () => {
    const result = productDraftSchema.safeParse(validDraft({ title: "" }))
    expect(result.success).toBe(false)
  })

  test("rejects a missing description", () => {
    const result = productDraftSchema.safeParse(validDraft({ description: "" }))
    expect(result.success).toBe(false)
  })

  test("rejects a missing category", () => {
    const result = productDraftSchema.safeParse(validDraft({ category_id: "" }))
    expect(result.success).toBe(false)
  })

  test("rejects a zero base price", () => {
    const result = productDraftSchema.safeParse(validDraft({ base_price: 0 }))
    expect(result.success).toBe(false)
  })

  test("rejects a negative base price", () => {
    const result = productDraftSchema.safeParse(validDraft({ base_price: -500 }))
    expect(result.success).toBe(false)
  })

  test("rejects a non-integer base price", () => {
    const result = productDraftSchema.safeParse(validDraft({ base_price: 49.99 }))
    expect(result.success).toBe(false)
  })

  test("rejects a product with zero variants", () => {
    const result = productDraftSchema.safeParse(validDraft({ variants: [] }))
    expect(result.success).toBe(false)
  })

  test("rejects a variant with negative inventory", () => {
    const result = productDraftSchema.safeParse(
      validDraft({ variants: [{ color: "Blue", size: "M", inventory_quantity: -1 }] })
    )
    expect(result.success).toBe(false)
  })

  test("accepts a variant with zero inventory", () => {
    const result = productDraftSchema.safeParse(
      validDraft({ variants: [{ color: "Blue", size: "M", inventory_quantity: 0 }] })
    )
    expect(result.success).toBe(true)
  })

  test("rejects a variant with a zero price override", () => {
    const result = productDraftSchema.safeParse(
      validDraft({
        variants: [{ color: "Blue", size: "M", inventory_quantity: 1, price: 0 }],
      })
    )
    expect(result.success).toBe(false)
  })

  test("accepts a variant with no price override (defaults to base_price downstream)", () => {
    const result = productDraftSchema.safeParse(
      validDraft({ variants: [{ color: "Blue", size: "M", inventory_quantity: 1 }] })
    )
    expect(result.success).toBe(true)
  })

  test("rejects duplicate color/size combinations", () => {
    const result = productDraftSchema.safeParse(
      validDraft({
        variants: [
          { color: "Blue", size: "M", inventory_quantity: 5 },
          { color: "Blue", size: "M", inventory_quantity: 3 },
        ],
      })
    )
    expect(result.success).toBe(false)
  })

  test("duplicate detection is case-insensitive and trims whitespace", () => {
    const result = productDraftSchema.safeParse(
      validDraft({
        variants: [
          { color: "Blue", size: "M", inventory_quantity: 5 },
          { color: " blue ", size: " m ", inventory_quantity: 3 },
        ],
      })
    )
    expect(result.success).toBe(false)
  })

  test("accepts multiple distinct color/size combinations", () => {
    const result = productDraftSchema.safeParse(
      validDraft({
        variants: [
          { color: "Blue", size: "M", inventory_quantity: 5 },
          { color: "Blue", size: "L", inventory_quantity: 3 },
          { color: "Black", size: "M", inventory_quantity: 2 },
        ],
      })
    )
    expect(result.success).toBe(true)
  })
})

describe("addProductImageSchema", () => {
  test("accepts a valid image url", () => {
    expect(addProductImageSchema.safeParse({ url: "https://example.test/a.jpg" }).success).toBe(
      true
    )
  })

  test("defaults is_primary to false", () => {
    const result = addProductImageSchema.parse({ url: "https://example.test/a.jpg" })
    expect(result.is_primary).toBe(false)
  })

  test("rejects a missing url", () => {
    expect(addProductImageSchema.safeParse({ url: "" }).success).toBe(false)
  })
})

describe("rejectProductListingSchema", () => {
  test("requires a non-empty reason", () => {
    expect(rejectProductListingSchema.safeParse({ reason: "" }).success).toBe(false)
  })

  test("accepts a valid reason", () => {
    expect(rejectProductListingSchema.safeParse({ reason: "Poor image quality" }).success).toBe(
      true
    )
  })
})
