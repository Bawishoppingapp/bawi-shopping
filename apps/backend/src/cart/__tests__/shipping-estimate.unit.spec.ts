import { calculateShippingEstimate } from "../shipping-estimate"

describe("calculateShippingEstimate", () => {
  test("charges the standard fee when the subtotal is below the free-shipping threshold", () => {
    const result = calculateShippingEstimate(5000, 699, 7500)
    expect(result).toEqual({
      shipping_estimate: 699,
      qualifies_for_free_shipping: false,
      amount_remaining_for_free_shipping: 2500,
    })
  })

  test("waives the fee once the subtotal meets the free-shipping threshold", () => {
    const result = calculateShippingEstimate(7500, 699, 7500)
    expect(result).toEqual({
      shipping_estimate: 0,
      qualifies_for_free_shipping: true,
      amount_remaining_for_free_shipping: 0,
    })
  })

  test("waives the fee when the subtotal exceeds the threshold", () => {
    const result = calculateShippingEstimate(10000, 699, 7500)
    expect(result.shipping_estimate).toBe(0)
    expect(result.qualifies_for_free_shipping).toBe(true)
  })

  test("a zero threshold always qualifies for free shipping", () => {
    const result = calculateShippingEstimate(0, 699, 0)
    expect(result.qualifies_for_free_shipping).toBe(true)
    expect(result.shipping_estimate).toBe(0)
  })

  test("an empty cart (zero subtotal) is not charged shipping progress against a positive threshold incorrectly", () => {
    const result = calculateShippingEstimate(0, 699, 7500)
    expect(result.amount_remaining_for_free_shipping).toBe(7500)
    expect(result.qualifies_for_free_shipping).toBe(false)
  })
})
