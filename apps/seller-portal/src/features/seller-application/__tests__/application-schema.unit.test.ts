import { describe, expect, test } from "vitest"
import { applicationSchema } from "../schemas/application-schema"

const validInput = {
  legal_business_name: "Acme Denim LLC",
  store_name: "Acme Denim",
  business_type: "llc",
  contact_first_name: "Jane",
  contact_last_name: "Doe",
  business_email: "jane@acmedenim.test",
  phone_number: "555-123-4567",
  website_url: "",
  address_line1: "123 Main St",
  address_line2: "",
  address_city: "Austin",
  address_state: "TX",
  address_postal_code: "78701",
  address_country: "US",
  currency_code: "usd",
  product_categories: ["Accessories"],
  business_description: "We make quality denim.",
  estimated_product_count: 50,
  agreed_to_terms: true,
}

describe("applicationSchema", () => {
  test("accepts valid input", () => {
    const result = applicationSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  test("rejects a missing legal business name", () => {
    const result = applicationSchema.safeParse({ ...validInput, legal_business_name: "" })
    expect(result.success).toBe(false)
  })

  test("rejects an invalid business type", () => {
    const result = applicationSchema.safeParse({ ...validInput, business_type: "hobbyist" })
    expect(result.success).toBe(false)
  })

  test("accepts ETB as a currency choice", () => {
    const result = applicationSchema.safeParse({ ...validInput, currency_code: "etb" })
    expect(result.success).toBe(true)
  })

  test("rejects an unsupported currency", () => {
    const result = applicationSchema.safeParse({ ...validInput, currency_code: "eur" })
    expect(result.success).toBe(false)
  })

  test("rejects a malformed business email", () => {
    const result = applicationSchema.safeParse({ ...validInput, business_email: "not-an-email" })
    expect(result.success).toBe(false)
  })

  test("rejects an empty product category selection", () => {
    const result = applicationSchema.safeParse({ ...validInput, product_categories: [] })
    expect(result.success).toBe(false)
  })

  test("rejects a non-positive estimated product count", () => {
    const result = applicationSchema.safeParse({ ...validInput, estimated_product_count: 0 })
    expect(result.success).toBe(false)
  })

  test("rejects when terms are not agreed to", () => {
    const result = applicationSchema.safeParse({ ...validInput, agreed_to_terms: false })
    expect(result.success).toBe(false)
  })

  test("rejects a malformed website URL when provided", () => {
    const result = applicationSchema.safeParse({ ...validInput, website_url: "not-a-url" })
    expect(result.success).toBe(false)
  })

  test("accepts an empty website URL", () => {
    const result = applicationSchema.safeParse({ ...validInput, website_url: "" })
    expect(result.success).toBe(true)
  })

  test("rejects an invalid country code", () => {
    const result = applicationSchema.safeParse({ ...validInput, address_country: "USA" })
    expect(result.success).toBe(false)
  })

  test("accepts an Ethiopian address with no postal code", () => {
    const result = applicationSchema.safeParse({
      ...validInput,
      address_country: "ET",
      address_state: "",
      address_postal_code: "",
    })
    expect(result.success).toBe(true)
  })

  test("rejects a US address with no postal code", () => {
    const result = applicationSchema.safeParse({
      ...validInput,
      address_country: "US",
      address_postal_code: "",
    })
    expect(result.success).toBe(false)
  })
})
