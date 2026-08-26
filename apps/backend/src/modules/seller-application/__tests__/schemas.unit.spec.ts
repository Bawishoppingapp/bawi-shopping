import {
  submitApplicationSchema,
  rejectApplicationSchema,
  completeActivationSchema,
} from "../schemas"

const validApplication = {
  legal_business_name: "Acme Denim LLC",
  store_name: "Acme Denim",
  business_type: "llc",
  contact_first_name: "Jane",
  contact_last_name: "Doe",
  business_email: "jane@acmedenim.test",
  phone_number: "555-123-4567",
  website_url: "https://acmedenim.example.com",
  address: {
    line1: "123 Main St",
    city: "Austin",
    state: "TX",
    postal_code: "78701",
    country: "US",
  },
  product_categories: ["Denim", "Accessories"],
  business_description: "We make quality denim.",
  estimated_product_count: 50,
  agreed_to_terms: true,
}

describe("submitApplicationSchema", () => {
  test("accepts a fully valid application", () => {
    expect(submitApplicationSchema.safeParse(validApplication).success).toBe(true)
  })

  test("rejects a missing legal business name", () => {
    const result = submitApplicationSchema.safeParse({
      ...validApplication,
      legal_business_name: "",
    })
    expect(result.success).toBe(false)
  })

  test("rejects an invalid business type", () => {
    const result = submitApplicationSchema.safeParse({
      ...validApplication,
      business_type: "hobbyist",
    })
    expect(result.success).toBe(false)
  })

  test("rejects a malformed business email", () => {
    const result = submitApplicationSchema.safeParse({
      ...validApplication,
      business_email: "not-an-email",
    })
    expect(result.success).toBe(false)
  })

  test("rejects an incomplete address", () => {
    const result = submitApplicationSchema.safeParse({
      ...validApplication,
      address: { line1: "123 Main St" },
    })
    expect(result.success).toBe(false)
  })

  test("rejects an empty product category list", () => {
    const result = submitApplicationSchema.safeParse({
      ...validApplication,
      product_categories: [],
    })
    expect(result.success).toBe(false)
  })

  test("rejects a non-positive estimated product count", () => {
    const result = submitApplicationSchema.safeParse({
      ...validApplication,
      estimated_product_count: 0,
    })
    expect(result.success).toBe(false)
  })

  test("rejects when terms are not agreed to", () => {
    const result = submitApplicationSchema.safeParse({
      ...validApplication,
      agreed_to_terms: false,
    })
    expect(result.success).toBe(false)
  })

  test("accepts a missing (optional) website URL", () => {
    const { website_url, ...rest } = validApplication
    expect(submitApplicationSchema.safeParse(rest).success).toBe(true)
  })

  test("defaults currency_code to etb when omitted", () => {
    const result = submitApplicationSchema.safeParse(validApplication)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.currency_code).toBe("etb")
    }
  })

  test("accepts an Ethiopian address with no state or postal code", () => {
    const result = submitApplicationSchema.safeParse({
      ...validApplication,
      address: {
        line1: "Bole Road",
        city: "Addis Ababa",
        country: "ET",
      },
    })
    expect(result.success).toBe(true)
  })

  test("rejects a US address with no postal code", () => {
    const result = submitApplicationSchema.safeParse({
      ...validApplication,
      address: {
        line1: "123 Main St",
        city: "Austin",
        state: "TX",
        country: "US",
      },
    })
    expect(result.success).toBe(false)
  })
})

describe("rejectApplicationSchema", () => {
  test("accepts a non-empty reason", () => {
    expect(
      rejectApplicationSchema.safeParse({ reason: "Incomplete information" }).success
    ).toBe(true)
  })

  test("rejects an empty reason", () => {
    expect(rejectApplicationSchema.safeParse({ reason: "" }).success).toBe(false)
  })

  test("rejects a missing reason", () => {
    expect(rejectApplicationSchema.safeParse({}).success).toBe(false)
  })
})

describe("completeActivationSchema", () => {
  test("accepts a valid token and strong password", () => {
    expect(
      completeActivationSchema.safeParse({ token: "abc123", password: "Correct1horse" })
        .success
    ).toBe(true)
  })

  test("rejects a weak password", () => {
    expect(
      completeActivationSchema.safeParse({ token: "abc123", password: "weak" }).success
    ).toBe(false)
  })

  test("rejects a missing token", () => {
    expect(
      completeActivationSchema.safeParse({ token: "", password: "Correct1horse" }).success
    ).toBe(false)
  })
})
