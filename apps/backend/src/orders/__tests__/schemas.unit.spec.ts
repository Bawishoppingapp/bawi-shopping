import { startCheckoutSchema } from "../schemas"

const validAddress = {
  first_name: "Ada",
  last_name: "Lovelace",
  address_1: "123 Main St",
  city: "Dallas",
  province: "TX",
  postal_code: "75201",
  country_code: "US",
  phone: "+15555550100",
}

describe("startCheckoutSchema", () => {
  test("accepts a valid shipping address and idempotency key", () => {
    const result = startCheckoutSchema.safeParse({
      shipping_address: validAddress,
      idempotency_key: "idem-123",
    })
    expect(result.success).toBe(true)
  })

  test("rejects a missing required address field", () => {
    const { city, ...rest } = validAddress
    void city
    const result = startCheckoutSchema.safeParse({
      shipping_address: rest,
      idempotency_key: "idem-123",
    })
    expect(result.success).toBe(false)
  })

  test("rejects a country code that isn't exactly 2 letters", () => {
    const result = startCheckoutSchema.safeParse({
      shipping_address: { ...validAddress, country_code: "USA" },
      idempotency_key: "idem-123",
    })
    expect(result.success).toBe(false)
  })

  test("rejects a missing idempotency_key", () => {
    const result = startCheckoutSchema.safeParse({ shipping_address: validAddress })
    expect(result.success).toBe(false)
  })

  test("address_2 is optional", () => {
    const result = startCheckoutSchema.safeParse({
      shipping_address: { ...validAddress, address_2: "Apt 4" },
      idempotency_key: "idem-123",
    })
    expect(result.success).toBe(true)
  })
})
