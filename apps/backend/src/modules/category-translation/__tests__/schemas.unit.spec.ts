import { createCategorySchema, updateCategorySchema } from "../schemas"

describe("createCategorySchema", () => {
  test("accepts a minimal valid category", () => {
    const result = createCategorySchema.safeParse({ name: "Shirts" })
    expect(result.success).toBe(true)
  })

  test("rejects a missing name", () => {
    const result = createCategorySchema.safeParse({ name: "" })
    expect(result.success).toBe(false)
  })

  test("defaults is_active to true when omitted", () => {
    const result = createCategorySchema.safeParse({ name: "Shirts" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.is_active).toBe(true)
    }
  })

  test("accepts a parent_category_id", () => {
    const result = createCategorySchema.safeParse({
      name: "T-Shirts",
      parent_category_id: "pcat_123",
    })
    expect(result.success).toBe(true)
  })

  test("accepts translations for supported locales", () => {
    const result = createCategorySchema.safeParse({
      name: "Shirts",
      translations: { am: "ሸሚዞች", es: "Camisas" },
    })
    expect(result.success).toBe(true)
  })

  test("rejects a translation for an unsupported locale key", () => {
    const result = createCategorySchema.safeParse({
      name: "Shirts",
      translations: { "en-US": "Shirts" },
    })
    expect(result.success).toBe(false)
  })

  test("rejects an empty translation value", () => {
    const result = createCategorySchema.safeParse({
      name: "Shirts",
      translations: { am: "" },
    })
    expect(result.success).toBe(false)
  })
})

describe("updateCategorySchema", () => {
  test("accepts a partial update with only is_active", () => {
    const result = updateCategorySchema.safeParse({ is_active: false })
    expect(result.success).toBe(true)
  })

  test("accepts a null parent_category_id (move to top level)", () => {
    const result = updateCategorySchema.safeParse({ parent_category_id: null })
    expect(result.success).toBe(true)
  })

  test("rejects an empty name when provided", () => {
    const result = updateCategorySchema.safeParse({ name: "" })
    expect(result.success).toBe(false)
  })
})
